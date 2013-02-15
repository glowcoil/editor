(function() {
  var history = [], future = [];
  var tileWidth = 16;
  var tileHeight = 12;
  var tileDepth = 12;
  var tilesetFilename;
  var tilesetImage = new Image();

  /* ======== TOOLBAR ======== */
  function save() {
    var a = document.createElement("a");
    a.download = document.getElementById("filename").value + ".map";
    a.href = URL.createObjectURL(new Blob([JSON.stringify({
      tileWidth: tileWidth,
      tileHeight: tileHeight,
      tileDepth: tileDepth,
      tileset: tilesetFilename,
      width: width,
      height: height,
      depth: depth,
      tiles: tiles.slice(0, depth).map(function(layer) {
        return layer.slice(0, height).map(function(row) {
          return row.slice(0, width);
        });
      })
    })], { type: "text/plain; charset=UTF-8" }));
    var click = document.createEvent("Event"); click.initEvent("click"); a.dispatchEvent(click)
  }
  function load() {
    var reader = new FileReader();
    reader.onload = function() {
      var json = JSON.parse(reader.result);
      tileWidth = json.tileWidth;
      tileHeight = json.tileHeight;
      tileDepth = json.tileDepth;
      tilesetFilename = json.tileset; loadTileset(tilesetFilename);
      resize(json.width, json.height, json.depth);
      tiles = json.tiles;
      drawPalette();
      drawMap();
    };
    reader.readAsText(this.files[0]);
    var name = this.files[0].name;
    document.getElementById("filename").value = name.substring(0, name.length - 4);
    history = [];
  }
  function saveAction(action) {
    history.push(action);
    future = [];
    document.getElementById("undo").disabled = false;
    document.getElementById("redo").disabled = true;
  }
  function undo() {
    var action = history.pop();
    if (history.length === 0) {
      document.getElementById("undo").disabled = true;
    }
    if (action) {
      switch (action.changed) {
        case "mapSize":
          resize(action.oldWidth, action.oldHeight, action.oldDepth);
          cancelResizeMap();
        break; case "tileSize":
          tileWidth = action.oldWidth;
          tileHeight = action.oldHeight;
          tileDepth = action.oldDepth;
          drawPalette();
          drawMap();
          cancelResizeTiles();
        break; case "tileset":
          loadTileset(action.old);
          document.getElementById("tilesetform").reset();
        break; case "tiles":
          for (var z in action.olds) {
            for (var y in action.olds[z]) {
              for (var x in action.olds[z][y]) {
                tiles[z][y][x] = action.olds[z][y][x];
              }
            }
          }
          drawMap();
        break;
      }
      future.push(action);
      document.getElementById("redo").disabled = false;
    }
  }
  function redo() {
    var action = future.pop();
    if (future.length === 0) {
      document.getElementById("redo").disabled = true;
    }
    if (action) {
      switch (action.changed) {
        case "mapSize":
          resize(action.newWidth, action.newHeight, action.newDepth);
          cancelResizeMap();
        break; case "tileSize":
          tileWidth = action.newWidth;
          tileHeight = action.newHeight;
          tileDepth = action.newDepth;
          drawPalette();
          drawMap();
          cancelResizeTiles();
        break; case "tileset":
          loadTileset(action.new);
          document.getElementById("tilesetform").reset();
        break; case "tiles":
          for (var z in action.news) {
            for (var y in action.news[z]) {
              for (var x in action.news[z][y]) {
                tiles[z][y][x] = action.news[z][y][x];
              }
            }
          }
          drawMap();
        break;
      }
      history.push(action);
      document.getElementById("undo").disabled = false;
    }
  }
  function getTool() {
    var tool;
    var tools = document.getElementsByName("tool");
    for (i = 0; i < tools.length; i++) {
      if (tools[i].checked) {
        tool = tools[i].value; break;
      }
    }
    return tool;
  }
  function onTilesetChosen() {
    if (this.files[0].type === "image/png") {
      var action = { changed: "tileset", old: tilesetFilename };
      
      loadTileset(this.files[0].name, URL.createObjectURL(this.files[0]));
      
      if (action.old) {
        action.new = tilesetFilename;
        history.push(action);
      }
    } else {
      alert("Please choose a png image.");
      document.getElementById("tilesetform").reset();
    }
  }
  function loadTileset(filename, url) {
    tilesetImage.onload = function() {
      palette.width = tilesetImage.width;
      palette.height = tilesetImage.height;
      drawPalette();
      drawMap();
    };
    tilesetImage.src = url || filename;
    tilesetFilename = filename;
  }
  function resizeMap() {
    var action = { changed: "mapSize", oldWidth: width, oldHeight: height, oldDepth: depth };
    
    var newWidth = parseInt(document.getElementById("mapwidth").value), newHeight = parseInt(document.getElementById("mapheight").value), newDepth = parseInt(document.getElementById("mapdepth").value);
    resize(newWidth, newHeight, newDepth);
    
    action.newWidth = width; action.newHeight = height; action.newDepth = depth;
    saveAction(action);
  }
  function cancelResizeMap() {
    document.getElementById("mapwidth").value = width;
    document.getElementById("mapheight").value = height;
    document.getElementById("mapdepth").value = depth;
  }
  function resizeTiles() {
    var action = { changed: "tileSize", oldWidth: tileWidth, oldHeight: tileHeight, oldDepth: tileDepth };
    
    tileWidth = parseInt(document.getElementById("tilewidth").value);
    tileHeight = parseInt(document.getElementById("tileheight").value);
    tileDepth = parseInt(document.getElementById("tiledepth").value);
    drawPalette();
    drawMap();
    
    action.newWidth = tileWidth; action.newHeight = tileHeight; action.newDepth = newDepth;
    saveAction(action);
  }
  function cancelResizeTiles() {
    document.getElementById("tilewidth").value = tileWidth;
    document.getElementById("tileheight").value = tileDepth;
    document.getElementById("tiledepth").value = tileHeight;
  }

  /* ======== PALETTE ======== */
  var palette, paletteContext, paletteMouseX, paletteMouseY;
  var tile = 0;

  function drawPalette() {
    paletteContext.fillStyle = "black";
    paletteContext.fillRect(0, 0, palette.width, palette.height);
    paletteContext.drawImage(tilesetImage, 0, 0);
    var x = (tile * tileWidth) % palette.width, y = Math.floor((tile * tileWidth) / palette.width) * (tileHeight + tileDepth);
    paletteContext.strokeStyle = "white";
    paletteContext.strokeRect(x, y, tileWidth, tileHeight + tileDepth);
  }
  /* palette mouse handling */
  function paletteOnMouseMove(event) {
    var totalOffsetX = 0;
    var totalOffsetY = 0;
    var currentElement = palette;
    do {
      totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
      totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
    } while (currentElement = currentElement.offsetParent)
    paletteMouseX = event.pageX - totalOffsetX;
    paletteMouseY = event.pageY - totalOffsetY;
  }
  function paletteOnClick() {
    tile = (Math.floor(paletteMouseY/(tileHeight + tileDepth)) * Math.floor(palette.width/tileWidth)) + Math.floor(paletteMouseX/tileWidth);
    drawPalette();
  }

  /* ======== MAP ======== */
  var map, mapContext, mapMouseX, mapMouseY;
  var width = 0;
  var height = 0;
  var depth = 0;
  var tiles = [];
  var layer = 0;

  function resize(w, h, d) {
    width = w;
    height = h;
    depth = d;
    for (var z = 0; z < depth; z++) {
      if (typeof tiles[z] === "undefined") tiles[z] = [];
      for (var y = 0; y < height; y++) {
        if (typeof tiles[z][y] === "undefined") tiles[z][y] = [];
        for (var x = 0; x < width; x++) {
          if (typeof tiles[z][y][x] === "undefined") tiles[z][y][x] = 0;
        }
      }
    }
    map.width = width * tileWidth;
    map.height = depth * tileDepth + height * tileHeight;
    
    cancelResizeMap();
    drawMap();
  }
  function drawMap() {
    mapContext.fillStyle = "black";
    mapContext.fillRect(0, 0, map.width, map.height);
    for (var z = 0; z < depth; z++) {
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          var tileX = (tiles[z][y][x] % Math.floor(palette.width / tileWidth)) * tileWidth;
          var tileY = Math.floor((tiles[z][y][x] * tileWidth) / palette.width) * (tileHeight + tileDepth);
          if (z <= layer) {
            mapContext.globalAlpha = 1.0;
          } else {
            mapContext.globalAlpha = 0.3;
          }
          mapContext.drawImage(tilesetImage, tileX, tileY, tileWidth, tileHeight + tileDepth, x * tileWidth, y * tileHeight + (depth-1)*tileDepth - z*tileDepth, tileWidth, tileHeight + tileDepth);
          mapContext.globalAlpha = 1.0;
        }
      }
    }
    if (drawingRectangle) {
      mapContext.strokeStyle = "white";
      var rectX, rectY, rectWidth, rectHeight;
      if (rectangleWidth >= 0) { rectX = rectangleX * tileWidth; rectWidth = (rectangleWidth + 1) * tileWidth; }
      else { rectX = (rectangleX + 1) * tileWidth; rectWidth = (rectangleWidth - 1) * tileWidth; }
      if (rectangleHeight >= 0) { rectY = rectangleY * tileHeight + (depth-1)*tileDepth - layer*tileDepth; rectHeight = (rectangleHeight + 1) * tileHeight; }
      else { rectY = (rectangleY + 1) * tileHeight + (depth-1)*tileDepth - layer*tileDepth; rectHeight = (rectangleHeight - 1) * tileHeight; }
      mapContext.strokeRect(rectX, rectY, rectWidth, rectHeight);
    }
  }
  function mapOnMouseMove(event) {
    var totalOffsetX = 0;
    var totalOffsetY = 0;
    var currentElement = map;
    do {
      totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
      totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
    } while (currentElement = currentElement.offsetParent)
    mapMouseX = event.pageX - totalOffsetX;
    mapMouseY = event.pageY - totalOffsetY;
  }
  var mouseAction;
  var drawingRectangle = false;
  var rectangleX, rectangleY, rectangleWidth, rectangleHeight;
  function mapWhileClicked() {
    if (!mouseAction) mouseAction = { changed: "tiles", olds: {}, news: {} };
    
    var y = Math.floor((mapMouseY - (depth*tileDepth) + (layer*tileDepth) + tileDepth) / tileHeight);
    var x = Math.floor(mapMouseX / tileWidth);
    if (getTool() === "rectangle") {
      if (!drawingRectangle) {
        drawingRectangle = true;
        rectangleX = Math.max(0, Math.min(x, tiles[layer][0].length - 1));
        rectangleY = Math.max(0, Math.min(y, tiles[layer].length - 1));
      } else {
        rectangleWidth = Math.max(0, Math.min(x, tiles[layer][0].length - 1)) - rectangleX;
        rectangleHeight = Math.max(0, Math.min(y, tiles[layer].length - 1)) - rectangleY;
      }
    } else if (y >= 0 && y < tiles[layer].length) {
      mouseAction.olds[layer] = mouseAction.olds[layer] || {};
      mouseAction.olds[layer][y] = mouseAction.olds[layer][y] || {};
      if (typeof mouseAction.olds[layer][y][x] === "undefined") {
        mouseAction.olds[layer][y][x] = tiles[layer][y][x];
      }
      tiles[layer][y][x] = tile;
      
      mouseAction.news[layer] = mouseAction.news[layer] || {};
      mouseAction.news[layer][y] = mouseAction.news[layer][y] || {};
      mouseAction.news[layer][y][x] = tiles[layer][y][x];
    }
    drawMap();
  }
  function mapOnMouseUp() {
    if (drawingRectangle) {
      drawingRectangle = false;
      
      var yStep = rectangleHeight >= 0 ? 1 : -1;
      var xStep = rectangleWidth >= 0 ? 1 : -1;
      var coords;
      for (var y = rectangleY; y != rectangleY + rectangleHeight + yStep; y += yStep) {
        for (var x = rectangleX; x != rectangleX + rectangleWidth + xStep; x += xStep) {
          mouseAction.olds[layer] = mouseAction.olds[layer] || {};
          mouseAction.olds[layer][y] = mouseAction.olds[layer][y] || {};
          if (typeof mouseAction.olds[layer][y][x] === "undefined") {
            mouseAction.olds[layer][y][x] = tiles[layer][y][x];
          }
          tiles[layer][y][x] = tile;
          
          mouseAction.news[layer] = mouseAction.news[layer] || {};
          mouseAction.news[layer][y] = mouseAction.news[layer][y] || {};
          mouseAction.news[layer][y][x] = tiles[layer][y][x];
        }
      }
      
      rectangleWidth = 0; rectangleHeight = 0;
      drawMap();
    }
    if (mouseAction) {
      saveAction(mouseAction);
      mouseAction = undefined;
    }
  }
  function upALayer() {
    if (layer < depth - 1) {
      layer += 1;
      drawMap();
      displayLayer();
    }
  }
  function downALayer() {
    if (layer > 0) {
      layer -= 1;
      drawMap();
      displayLayer();
    }
  }
  function displayLayer() {
    var l = document.getElementById("layer");
    while (l.childNodes.length > 0) {
      l.removeChild(l.firstChild);
    }
    l.appendChild(document.createTextNode(layer));
  }

  /* ======== INITIALIZE ======== */
  window.onload = function() {
    map = document.getElementById("map");
    map.width = width * tileWidth;
    map.height = height * tileHeight;
    mapContext = map.getContext("2d");

    palette = document.getElementById("palette");
    paletteContext = palette.getContext("2d");

    resize(20, 20, 2);
    history = [];
    cancelResizeTiles();

    drawPalette();

    /* handling input from toolbar */
    document.getElementById("save").addEventListener("click", save, false);
    document.getElementById("load").addEventListener("change", load, false);
    document.getElementById("undo").addEventListener("click", undo, false);
    document.getElementById("undo").disabled = true;
    document.getElementById("redo").addEventListener("click", redo, false);
    document.getElementById("redo").disabled = true;
    displayLayer();
    document.getElementById("tileset").addEventListener("change", onTilesetChosen, false);
    document.getElementById("up").addEventListener("click", upALayer, false);
    document.getElementById("down").addEventListener("click", downALayer, false);
    document.getElementById("resizemap").addEventListener("click", resizeMap, false);
    document.getElementById("cancelresizemap").addEventListener("click", cancelResizeMap, false);
    document.getElementById("resizetiles").addEventListener("click", resizeTiles, false);
    document.getElementById("cancelresizetiles").addEventListener("click", cancelResizeTiles, false);

    /* mouse handling on map and palette */
    var mapWhileClickedIntervalId;
    map.addEventListener("mousedown", function(event) {
      mapWhileClickedIntervalId = setInterval(mapWhileClicked, 1);
    }, false);
    document.addEventListener("mouseup", function() {
      mapOnMouseUp();
      clearInterval(mapWhileClickedIntervalId);
    }, false);
    palette.addEventListener("mousedown", paletteOnClick, false);
    document.addEventListener("mousemove", mapOnMouseMove, false);
    document.addEventListener("mousemove", paletteOnMouseMove, false);
  };
})();