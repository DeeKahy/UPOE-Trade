
if (window.location.href.includes("poe.ninja")) {
    let league = "Standard";
    let url = `https://www.pathofexile.com/api/trade/search/${league}`;
    let target = null;
    let button = null;
    let currentItem;
    let isItUnique;
    let newButton = null;

    let json;

    function startObserver() {
        const fileUrl = chrome.runtime.getURL('stats.json');
        console.log(fileUrl);
        fetch(fileUrl)

            .then((response) => response.json())
            .then((data) => {
                console.log("Here is your JSON data:", data);
                json = data;
            })
            .catch((error) => console.error("Error loading JSON:", error));
        const root = document.documentElement;
        const observer = new MutationObserver((mutation, observer) => {
            mutation.forEach((element) => {
                if (element.target != null && element.target.tagName != "a" && element.target.tagName != "HEAD" && element.target.tagName != "BODY" && element.target.tagName != "IMG") {
                    if (element.type == "childList") {

                        let tempTarget = element.target.querySelector("h1");
                        if (tempTarget != null && tempTarget != target) {
                            let test = /<\/div>.*/g;
                            console.log(tempTarget.innerHTML);
                            target = tempTarget;

                            currentItem = target.innerHTML.replaceAll("<div>", "").replaceAll(test, "");
                            isItUnique = target.style.color.includes("--item-unique") ? true : false;
                            if (button != null) {
                                console.log("button found 2")
                                setTimeout(() => {
                                    printButton();
                                }, 100);
                            }

                        }
                    }
                    else if (element.type == "attributes") {
                        let tempButton = element.target.querySelector(".button")
                        if (tempButton != null && tempButton != button && tempButton != newButton) {
                            button = tempButton;
                            console.log("button found 1")
                        }



                        //     if (element.target.lastChild.className != "tradingo") {

                        //         // let span = document.createElement("span");
                        //         // let tradingo = document.createElement("div");
                        //         let filters = [];
                        //         // span.textContent = "trade";
                        //         let button = element.target.querySelector(".button");
                        //         let test = button.cloneNode(true);

                        //         test.textContent = "Trade"
                        //         test.style.position = "absolute";
                        //         test.style.bottom = 0;
                        //         button.parentNode.appendChild(test);
                        //         // let spanage = /<span>.*/gi
                        //         // element.target.querySelectorAll("span").forEach((el) => {
                        //         //     let temp = el.innerHTML.replace()
                        //         // })

                        //         // span.addEventListener("click", (e) => {
                        //         //     navigator.clipboard.readText()
                        //         //         .then(text => {
                        //         //             console.log(text);
                        //         //             // Use the text here
                        //         //         })
                        //         //         .catch(err => console.error("Failed to read clipboard:", err));
                        //         //     console.log(copyto())
                        //         //     // e.preventDefault();
                        //         //     // console.log(currentItem);
                        //         //     // const url = `https://www.pathofexile.com/api/trade/search/${league}`;

                        //         //     // const jsonData = {
                        //         //     //     "query": {
                        //         //     //         "status": {
                        //         //     //             "option": "available"
                        //         //     //         },
                        //         //     //         "name": isItUnique ? currentItem : "",
                        //         //     //         "stats": [{
                        //         //     //             "type": "and",
                        //         //     //             "filters": []
                        //         //     //         }]
                        //         //     //     },
                        //         //     //     "sort": {
                        //         //     //         "price": "asc"
                        //         //     //     }
                        //         //     // };

                        //         //     // chrome.runtime.sendMessage({
                        //         //     //     url: url,
                        //         //     //     body: JSON.stringify(jsonData)
                        //         //     // }, (response) => {
                        //         //     //     if (response.success) {
                        //         //     //         console.log(response.data)
                        //         //     //         window.open("https://www.pathofexile.com/trade/search/Phrecia%202.0/" + response.data.id)
                        //         //     //     } else {
                        //         //     //         console.error('Error:', response.error);
                        //         //     //     }
                        //         //     // });
                        //         // })
                        //         // tradingo.className = "tradingo"
                        //         // tradingo.appendChild(span);
                        //         // element.target.appendChild(tradingo);
                        //         // lastElement = tradingo;
                        //     }


                    };
                }
            })

        })

        observer.observe(root, {
            childList: true,
            subtree: true,
            attributes: true
        });

        console.log("observer attached");

    }
    function printButton() {
        newButton = button.cloneNode(true);
        newButton.textContent = "trade";
        newButton.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const capturePromise = new Promise((resolve) => {
                window.addEventListener('message', function handler(event) {
                    if (event.data.type === 'POE_ITEM_DATA_CAPTURE') {
                        window.removeEventListener('message', handler);
                        resolve(event.data.text);
                    }
                });
            });
            const captureScript = document.createElement('script');
            captureScript.textContent = `
                                (function() {
                                    const original = navigator.clipboard.writeText.bind(navigator.clipboard);
                                    navigator.clipboard.writeText = function(text) {
                                        window.postMessage({ type: 'POE_ITEM_DATA_CAPTURE', text: text }, '*');
                                        return Promise.resolve(); // Don't actually copy
                                    };
    
                                    // Restore after a short delay
                                    setTimeout(() => {
                                        navigator.clipboard.writeText = original;
                                    }, 100);
                                })();
                                `;
            document.head.appendChild(captureScript);
            captureScript.remove();
            button.click();
            const itemData = await capturePromise;
            console.log(itemData)
            goToTradeSite(itemData);
        })

        target.parentNode.appendChild(newButton);
    }
    function goToTradeSite(itemData) {
        let filters = [];
        itemData = itemData.split("--------");
        itemData = itemData.reverse()
        itemData.splice(0, 1);
        let index = itemData.indexOf("\n");
        itemData.splice(index)
        let things = itemData[0].split("\n");
        things.forEach((el) => {
            if (el.length > 0) {
                let found;
                let regex = /\s\(.+\)/g;
                let stat = el.replace(regex, "");
                let extractor = /\d+(\.?\d+)?/g;
                let numberObj = stat.match(extractor)?.map(Number)
                stat = stat.replace(extractor, "#");
                stat = stat.replace("an", "#");
                if (json && json.result) {
                    for (const category of json.result) {
                        if (category.entries) {
                            found = category.entries.find((obj) => {
                                return Object.values(obj).some(val => val === stat);
                            });
                            if (found) break;
                        }
                    }
                }

                if (found) {

                    if (numberObj != undefined) {
                        // found.values = {};
                        found.min = numberObj[0];
                    }
                    filters.push(found);

                }
                else {
                    console.log("not found " + stat);
                }
            }

        })

        const jsonData = {
            "query": {
                "status": {
                    "option": "available"
                },
                ...(isItUnique ? { "name": currentItem } : {}),
                "stats": [{
                    "type": "and",
                    "filters": filters,
                }]
            },
            "sort": {
                "price": "asc"
            }
        };
        console.log(jsonData);
        chrome.runtime.sendMessage({
            url: url,
            body: JSON.stringify(jsonData)
        }, (response) => {
            if (response.success) {
                console.log(response.data)
                window.open("https://www.pathofexile.com/trade/search/Phrecia%202.0/" + response.data.id)
            } else {
                console.error('Error:', response.error);
            }
        });
    }
    setTimeout(() => {

        startObserver();
    }, 500);

}


