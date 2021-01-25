const net = require('net');
const utils = require('./utils');
const { Resolver } = require('dns').promises;

const resolver = new Resolver();

/**
 * Validate domain name syntax.
 *
 * Copied from https://regexr.com/3au3g
 * @param {string} domain
 * @returns {boolean}
 */
function validateDomain(domain) {
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,197}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/;
    return domainRegex.test(domain);
}

/**
 * Parse hostname and port from server name.
 *
 * @param {string} serverName
 * @return {object}
 */
function parseHostnameAndPort(serverName) {
    let hostname;
    let port;
    const portIdx = serverName.lastIndexOf(':');
    if (portIdx > 0) {
        hostname = serverName.slice(0, portIdx);
        port = serverName.slice(portIdx+1);
        if (port.length === 0 || !Number.isInteger(parseInt(port))) {
            throw Error('Malformed port in serverName');
        }
    } else {
        hostname = serverName;
        port = '8448';
    }
    return {
        hostname,
        port,
        defaultPort: portIdx === -1,
    };
}

/**
 * Homeserver URL discovery as per S2S spec
 *
 * https://matrix.org/docs/spec/server_server/r0.1.4#server-discovery
 *
 * @param {string} serverName       The server name to discover for
 * @returns {Promise<object>}       The homeserver discovery information
 */
async function discoverHomeserverUrl(serverName) {
    let {hostname, port, defaultPort} = parseHostnameAndPort(serverName);

    // Don't continue if we consider the hostname part to resolve to our blacklisted IP ranges
    if (await utils.isDomainBlacklisted(hostname)) {
        throw Error('Hostname resolves to a blacklisted IP range.');
    }

    /**
     * 1. If the hostname is an IP literal, then that IP address should be used, together with the given port number,
     * or 8448 if no port is given. The target server must present a valid certificate for the IP address.
     * The Host header in the request should be set to the server name, including the port if the server
     * name included one.
     */
    if (net.isIP(hostname)) {
        return {
            homeserverUrl: `https://${hostname}:${port}`,
            serverName: serverName,
        };
    }

    if (!validateDomain(hostname)) {
        throw Error('Not an IP, not a domain, cannot continue discovery rules');
    }

    /**
     * 2. If the hostname is not an IP literal, and the server name includes an explicit port,
     * resolve the IP address using AAAA or A records. Requests are made to the resolved IP address and
     * given port with a Host header of the original server name (with port).
     * The target server must present a valid certificate for the hostname.
     */
    if (!defaultPort) {
        return {
            homeserverUrl: `https://${serverName}`,
            serverName: serverName,
        };
    }

    /**
     * 3. If the hostname is not an IP literal, a regular HTTPS request is made to
     * https://<hostname>/.well-known/matrix/server
     */
    let delegatedHostname;
    let response;
    try {
        response = await utils.axiosGet(`https://${hostname}/.well-known/matrix/server`);
        delegatedHostname = response.data && response.data['m.server'];
    } catch (e) {
        // Pass
    }
    if (delegatedHostname) {
        const parsed = parseHostnameAndPort(delegatedHostname);

        // Don't continue if we consider the hostname part to resolve to our blacklisted IP ranges
        if (await utils.isDomainBlacklisted(parsed.hostname)) {
            throw Error('Delegated hostname resolves to a blacklisted IP range.');
        }

        /**
         * If <delegated_hostname> is an IP literal, then that IP address should be used together with the
         * <delegated_port> or 8448 if no port is provided. The target server must present a valid TLS certificate
         * for the IP address. Requests must be made with a Host header containing the IP address,
         * including the port if one was provided.
         */
        if (net.isIP(parsed.hostname)) {
            return {
                homeserverUrl: `https://${parsed.hostname}:${parsed.port}`,
                serverName: delegatedHostname,
            };
        }

        if (validateDomain(parsed.hostname)) {
            /**
             * If <delegated_hostname> is not an IP literal, and <delegated_port> is present, an IP address is
             * discovered by looking up an AAAA or A record for <delegated_hostname>. The resulting IP address
             * is used, alongside the <delegated_port>. Requests must be made with a Host header of
             * <delegated_hostname>:<delegated_port>. The target server must present a valid certificate for
             * <delegated_hostname>.
             */
            if (!parsed.defaultPort) {
                return {
                    homeserverUrl: `https://${delegatedHostname}`,
                    serverName: delegatedHostname,
                };
            }

            /**
             * If <delegated_hostname> is not an IP literal and no <delegated_port> is present, an SRV record is
             * looked up for _matrix._tcp.<delegated_hostname>. This may result in another hostname (to be resolved
             * using AAAA or A records) and port. Requests should be made to the resolved IP address and port with
             * a Host header containing the <delegated_hostname>. The target server must present a valid
             * certificate for <delegated_hostname>.
             */
            const records = await resolver.resolveSrv(`_matrix._tcp.${delegatedHostname}`);
            if (records && records.length > 0) {
                let record = records[0];
                return {
                    homeserverUrl: `https://${record.name}:${record.port}`,
                    serverName: delegatedHostname,
                };
            }

            /**
             * If no SRV record is found, an IP address is resolved using AAAA or A records. Requests are then
             * made to the resolve IP address and a port of 8448, using a Host header of <delegated_hostname>.
             * The target server must present a valid certificate for <delegated_hostname>.
             */
            return {
                homeserverUrl: `https://${delegatedHostname}:8448`,
                serverName: delegatedHostname,
            };
        }
    }

    /**
     * 4. If the /.well-known request resulted in an error response, a server is found by resolving an SRV record
     * for _matrix._tcp.<hostname>. This may result in a hostname (to be resolved using AAAA or A records) and port.
     * Requests are made to the resolved IP address and port, using 8448 as a default port, with a Host
     * header of <hostname>. The target server must present a valid certificate for <hostname>.
     */
    const records = await resolver.resolveSrv(`_matrix._tcp.${hostname}`);
    if (records && records.length > 0) {
        let record = records[0];
        return {
            homeserverUrl: `https://${record.name}:${record.port || '8448'}`,
            serverName: hostname,
        };
    }

    /**
     * 5. If the /.well-known request returned an error response, and the SRV record was not found,
     * an IP address is resolved using AAAA and A records. Requests are made to the resolved IP address using
     * port 8448 and a Host header containing the <hostname>.
     * The target server must present a valid certificate for <hostname>.
     */
    return {
        homeserverUrl: `https://${hostname}:8448`,
        serverName: hostname,
    };
}

module.exports = {
    discoverHomeserverUrl,
    parseHostnameAndPort,
    validateDomain,
};
