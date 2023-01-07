function loadFolders(server, folderList, displayList) {
    console.log(server)
    console.log(folderList)
    console.log(displayList)
    const folderLists = folderList.split(',');
    const displayLists = displayList.split(',');
    let folderSet = {};
    const folderContainer = document.getElementById("folderNavi");
    for (let i = 0; i < folderLists.length; i++) {
        folderSet[folderLists[i]] = displayLists[i];
    }
    // console.table(folderSet);
    for (let key in folderSet) {
        const divBox = document.createElement("div");
        divBox.className = "link";
        const a = document.createElement("a");
        const linkText = document.createTextNode(folderSet[key]);
        a.appendChild(linkText);
        a.title = folderSet[key];
        a.href = "/" + server + "/" + key;
        divBox.appendChild(a);
        folderContainer.appendChild(divBox);
    }
}