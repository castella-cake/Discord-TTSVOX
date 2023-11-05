const { language_file } = require('../config.json');
const lang = require('../langs/' + language_file);

const { getUserData, setUserData, getServerData, setServerData, getDataBase, setDataBase } = require('./dbcontrol.js')
const interactionString = { server: lang.SAVE_SUCCESS_SERVER, personal: lang.SAVE_SUCCESS }

function addToDict(controlType, controlId, from, to) {
    return new Promise((resolve, reject) => {
        getDataBase(controlType, controlId).then(async data => {
            let moddedData = JSON.parse(JSON.stringify(data))
            // 変換元が一致するものが一つもないなら
            if ( moddedData.dict.filter(elem => elem.from.toLowerCase() === from.toLowerCase() ).length === 0) {
                // Pushする
                moddedData.dict.push({ from: from, to: to })
                setDataBase(controlType, controlId, moddedData)
                resolve({
                    content: interactionString[controlType] + "`" + from  + "` を `" + to + "` へ置き換えるよう" + lang.CONFIGURED,
                    ephemeral: (controlType === "personal")
                })
            } else {
                // task failed successfully
                resolve({
                    content: lang.CHANGE_FAILED + "`" + from + "`" + lang.ALREADY_EXIST,
                    ephemeral: true
                })
            }
        })
    })

}

function removeFromDict(controlType, controlId, from) {
    return new Promise((resolve, reject) => {
        getDataBase(controlType, controlId).then(async data => {
            let moddedUserData = JSON.parse(JSON.stringify(data))
            // 「お前消す」なワードのobjを探す
            const dictobj = moddedUserData.dict.find(elem => elem.from === from)
            //console.log(dictobj)
            if ( dictobj != undefined ) {
                // さっき探したやつでfilter
                moddedUserData.dict = moddedUserData.dict.filter(elem => elem !== dictobj)
                setUserData(controlId, moddedUserData)
                resolve({
                    content: interactionString[controlType] + "辞書から `" + from + "` " + lang.DELETED,
                    ephemeral: (controlType === "personal")
                })
            } else {
                resolve({
                    content: lang.WORD_NOT_FOUND,
                    ephemeral: true
                });
            }
        })
    })

}

module.exports = { addToDict, removeFromDict }