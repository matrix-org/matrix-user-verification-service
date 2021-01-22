const dns = require('dns');

function resolverFactory(resolverFn) {
    return (domain) => new Promise((resolve, reject) => {
        resolverFn(domain, (err, addresses) => {
            if (err) {
                if (err.errno === 'ENODATA' || err.errno === 'ENOTFOUND') {
                    resolve([]);
                    return;
                }
                reject(err);
                return;
            }
            resolve(addresses);
        });
    });
}

const resolve6 = resolverFactory(dns.resolve6);
const resolve4 = resolverFactory(dns.resolve4);

async function resolve(domain) {
    const v6Addresses = (await resolve6(domain)) || [];
    const v4Addresses = (await resolve4(domain)) || [];
    return [
        ...v6Addresses,
        ...v4Addresses,
    ];
}

module.exports = {
    resolve,
};
