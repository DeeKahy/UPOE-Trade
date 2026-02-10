let league = "Standard";
let currentItem = "";
let grid = document.querySelector(".grid");
function startObserver() {
    const root = document.documentElement;

    const observer = new MutationObserver((mutation, ovserver) => {
        mutation.forEach((element) => {
            if (element.type == "childList") {
                let test = /<\/div>.*/gi

                currentItem = element.target.querySelector("h1").innerHTML.replaceAll("<div>","").replaceAll(test,"");


            }
            else if (element.type == "attributes") {
                let anchor = document.createElement("a");
                anchor.textContent = "trade";
                anchor.addEventListener("click", (e) => {
                    e.preventDefault();
                    console.log(currentItem);
                    const url = `https://www.pathofexile.com/api/trade/search/${league}`;
                    
                    const jsonData = {
                        "query": {
                            "status": {
                                "option": "available"
                            },
                            "name": currentItem,
                            "stats": [{
                                "type": "and",
                                "filters": []
                            }]
                        },
                        "sort": {
                            "price": "asc"
                        }
                    };

                    chrome.runtime.sendMessage({
                        url: url,
                        body: JSON.stringify(jsonData)
                    }, (response) => {
                        if (response.success) {
                            console.log(response.data)
                            window.open("https://www.pathofexile.com/trade/search/Phrecia%202.0/"+response.data.id)
                        } else {
                            console.error('Error:', response.error);
                        }
                    });
                })
                element.target.prepend(anchor);
            }
        })
    });

    observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true
    });

    console.log("observer attached");
}


startObserver();
