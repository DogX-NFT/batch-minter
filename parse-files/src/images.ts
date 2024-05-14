import * as fs from "fs";

async function main() {
    const dir = '../../DogXCompleted/images/';
    const template = "DogX #";

    const files = await new Promise<string[]>((res, rej) => fs.readdir(dir, (err, files) => {
        if (err) rej(err);
        res(files);
    }))

    const targetFiles = files.filter(it => it.startsWith(template))
    // const targetFiles = files.filter(it => !isNaN(+it.split(".png")[0]));

    for(const i in targetFiles) {
        const name = targetFiles[i];

        const fromIndex = 208;
        const index = fromIndex + +name.split(template)[1].split(".png")[0] - 1;

        await new Promise<void>(res => {
            fs.rename(`${dir}/${name}`, `${dir}/${index}.png`, function(err) {
                if (err) console.log('ERROR: ' + err);
                res()
            });
        })
    }
}

main()
