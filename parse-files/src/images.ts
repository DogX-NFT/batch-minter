import * as fs from "fs";

async function main() {
    const folder = '../nft-assets/nfts/';
    const template = "DogX #";

    fs.readdir(folder, (err, files) => {
        files.filter(it => it.startsWith(template)).forEach(name => {
            fs.rename(`${folder}/${name}`, `${folder}/${name.split(template)[1]}`, function(err) {
                if (err) console.log('ERROR: ' + err);
            });
        })
    });
}

main()
