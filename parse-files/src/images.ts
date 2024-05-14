import * as fs from "fs";

async function main() {
    const folder = '../DogXCompleted/images/';
    const template = "DogX #";

    fs.readdir(folder, (err, files) => {
        files.filter(it => it.startsWith(template)).forEach(name => {

            const index = +name.split(template)[1].split(".png")[0]

            fs.rename(`${folder}/${name}`, `${folder}/${index - 1}.png`, function(err) {
                if (err) console.log('ERROR: ' + err);
            });
        })
    });
}

main()
