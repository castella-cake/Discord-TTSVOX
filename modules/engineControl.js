const { host_timeout } = require('../config.json');
const { createAudioResource } = require('@discordjs/voice');
const fs = require("fs");

function IsActiveHost(host) {
    return new Promise(async (resolve, reject) => {
        try {
            if ( host === "" ) {
                resolve(false)
            } else {
                const controller = new AbortController()
                await setTimeout(() => controller.abort(), host_timeout)
                fetch(`http://${host}/version`, {
                    method: "GET",
                    signal: controller.signal
                }).then(response => {
                    if ( response.status == 200 ) {
                        resolve(true)
                    } else {
                        resolve(response.status)
                    }
                }).catch((err) => {
                    resolve(err)
                })
            }

        } catch (err) {
            resolve(err)
        }
    })
}

function synthesisRequest(host, body, speakerId) {
    return new Promise((resolve,reject) => {
        fetch(`http://${host}/synthesis?speaker=${encodeURIComponent(speakerId)}`, {
            method: "POST",
            headers: {"Content-Type": "application/json", "accept": "audio/wav"},
            body: JSON.stringify(body)
        }).then(response => {
            //console.log(response)
            if (response.status === 200) {
                response.arrayBuffer().then(res => {
                    const buffer = Buffer.from(res)
                    fs.writeFile("temp/audio.wav", buffer, (err) => {
                        if (err) {
                            console.log(`ファイルの書き込みに失敗: ${err}`)
                        } else {
                            resolve(createAudioResource("temp/audio.wav"))
                            console.log(`ファイルを書き込みました`)
                            const resource = createAudioResource("temp/audio.wav");
                            resolve(resource)
                        }
                    })
                })
            } else {
                console.log(`VOICEVOXの呼び出しに失敗: ${response.status}`)
                response.text().then(res => {
                    console.log(res)
                    reject(res)
                })
            }
        }).catch((err) => {
            console.log(`VOICEVOXの呼び出しに失敗: ${err}`)
            response.text().then(res => {
                console.log(res)
                reject(res)
            })
        })
    })
}


module.exports = { synthesisRequest, IsActiveHost }