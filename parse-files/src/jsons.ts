import * as fs from "fs";
import axios from "axios";
import path from "path";

parseJsonToJsons();

async function main() {
    const files = (await new Promise<string[]>((res, rej) => fs.readdir("../nft-assets/nfts-metadata/data/", (err, files) => {
        if (err) rej(err);
        res(files);
    }))).filter(it => it.includes("."))

    for(const file of files) {
        const path = `../nft-assets/nfts-metadata/data/${file}`

        let json = JSON.parse(fs.readFileSync(path, 'utf8'));

        json.image = `https://dogx-nft.github.io/batch-minter/nft-assets/nfts/${file.split(".json")[0]}.png`

        fs.writeFile(path, JSON.stringify(json, null, 4), (e) => {
            if (e) console.error(e)
        })
    }
}

async function parseJsonToJsons() {
    let jsons = JSON.parse(fs.readFileSync("../DogXCompleted/meta.json", 'utf8')) as any[];

    for(const i in jsons) {
        const json = jsons[i];

        json.image = `${i}.png`

        fs.writeFile(`../DogXCompleted/parsed-meta/${i}.json`, JSON.stringify(json, null, 4), (e) => {
            if (e) console.error(e)
        })
    }
}

async function saveGGMetaAndImages() {
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

    for (let i = 0; i < arr.length; i++) {
        await downloadImage(`https://s.getgems.io/nft/c/63a2ea4fd187f681ba40ff77/${i}/image.png`, `../nft-assets/nfts-gg/${i}.png`)
    }
}

async function downloadImage(url: string, imagePath: string) {
    const response = await axios({ url, method: 'GET', responseType: 'stream' });
    const writer = fs.createWriteStream(imagePath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject)
    })
}
