import readingLocations from "./reading-locations.json";

type Reading = keyof typeof readingLocations;

function stripHtml(text: string) {
    return text.replaceAll("&#x2019;","'").replaceAll(/(<.*?>)|(&.*?;)/g, " ");
}

export function getReading(date: string, regionCode: string = "general", readingCode: any) {
    const url = `https://universalis.com/${regionCode}/${date}/jsonpmass.js`

    return new Promise<string>(
        (resolve, reject) => {
            if (Object.keys(readingLocations).includes(readingCode)) {
                const reading: Reading = readingCode;
                fetch(url).then((res) => res.text())
                .then(content => {
                    const jsonp = JSON.parse(content.slice(20, -3));
                    resolve(stripHtml(jsonp[readingLocations[reading]].text));
                }).catch(error => {
                    console.log(error)
                    reject()}
                );
            } else
                reject();
        }
    );
}