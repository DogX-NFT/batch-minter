import * as fs from "fs";

const jsons: any[] = [];

jsons.map(it => {
    const ind = +it.name.split("DogX #")[1];
    const fileName = `${ind - 1}.json`
    it.image = it.image.replace("ipfs://NewUriToReplace/", "https://dogx-nft.github.io/batch-minter/nft-assets/nfts/")
    it.description = "DogX — new forms of life on your planet. 3555 individuals are going to your planet. Don't worry, maybe we'll give you a game, or maybe new technology... It's up to you puppies.";

    fs.writeFile(`nfts/${fileName}`, JSON.stringify(it, null, 4), (e) => {
        if (e) console.error(e)
    })
})
