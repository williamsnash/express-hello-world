function loadFolders(folderList) {
    const folderLists = folderList.split(',');
    const folderContainer = document.getElementById("folderNavi");
    // console.table(folderSet);
    for (let key of folderLists) {
        const divBox = document.createElement("div");
        divBox.className = "link";
        const a = document.createElement("a");
        const linkText = document.createTextNode(key);
        a.appendChild(linkText);
        a.title = key;
        a.href = key;
        divBox.appendChild(a);
        folderContainer.appendChild(divBox);
    }
}