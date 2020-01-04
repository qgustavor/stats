function adler32 (data) {
  var a = 1
  var b = 0
  for (var i = 0; i < data.length; i++) {
    a = (a + data.charCodeAt(i)) % 65521
    b = (b + a) % 65521
  }
  return a | (b << 16)
}

function getAnimeColor (name, alternative, sheets) {
  if (sheets) {
    var keys = {
      anime: 'Animes',
      name: 'Nome',
      color1: 'Cor 1',
      color2: 'Cor 2'
    }

    var animeData = sheets[keys.anime].elements
    for (var i = 0; i < animeData.length; i++) {
      if (animeData[i][keys.name] === name) {
        var color = alternative
        ? animeData[i][keys.color2]
        : animeData[i][keys.color1]

        if (color) return color
        break
      }
    }
  }

  var normalized = name.toLowerCase()
  var color = tinycolor('#F22')
    .desaturate(
      adler32(normalized.substr(5)) % 30
    ).darken(
      adler32(normalized.substr(1,4)) % 20
    ).spin((normalized.charCodeAt(0) * 14.4) % 360)

  if (alternative) {
    color = color.darken(8)
  }

  return color
}