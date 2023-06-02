import * as fs from "fs";
import axios from "axios";
import path from "path";


const jsons: any[] = [];

// jsons.map(it => {
//     const ind = +it.name.split("DogX #")[1];
//     const fileName = `${ind - 1}.json`
//     it.image = it.image.replace("ipfs://NewUriToReplace/", "https://dogx-nft.github.io/batch-minter/nft-assets/nfts/")
//     it.description = "DogX — new forms of life on your planet. 3555 individuals are going to your planet. Don't worry, maybe we'll give you a game, or maybe new technology... It's up to you puppies.";
//
//     fs.writeFile(`nfts/${fileName}`, JSON.stringify(it, null, 4), (e) => {
//         if (e) console.error(e)
//     })
// })

async function main() {
    const arr = [...new Array(208)];

    for (let i = 0; i < arr.length; i++) {
        const { data } = await axios.get(`https://s.getgems.io/nft/c/63a2ea4fd187f681ba40ff77/${i}/meta.json`)
        const dir = `../nft-assets/nfts-metadata/data/${i}`;

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        fs.writeFile(`${dir}/meta.json`, JSON.stringify(data, null, 4), (e) => {
            if (e) console.error(e)
        })
    }

}
main();

// fs.mkdirSync(`../nft-assets/nfts/0`);

// fs.writeFile(`nfts/0/`, JSON.stringify("it", null, 4), (e) => {
//     if (e) console.error(e)
// })
