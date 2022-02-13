function xxHash32 (b,f) {f=void 0===f?0:f;var a=f+374761393&4294967295,c=0;if(16<=b.length){a=[f+2654435761+2246822519&4294967295,f+2246822519&4294967295,f+0&4294967295,f-2654435761&4294967295];var g=b.length-16,e=0;for(c=0;(c&4294967280)<=g;c+=4){var d=c;d=a[e]+(2246822519*(b[d+0]+(b[d+1]<<8))+(2246822519*(b[d+2]+(b[d+3]<<8))<<16))&4294967295;d=d<<13|d>>>19;a[e]=2654435761*(d&65535)+(2654435761*(d>>>16)<<16)&4294967295;e=e+1&3}a=(a[0]<<1|a[0]>>>31)+(a[1]<<7|a[1]>>>25)+(a[2]<<12|a[2]>>>20)+(a[3]<<18|a[3]>>>14)&4294967295}a=a+b.length&4294967295;for(g=b.length-4;c<=g;c+=4)e=c,a=a+(3266489917*(b[e+0]+(b[e+1]<<8))+(3266489917*(b[e+2]+(b[e+3]<<8))<<16))&4294967295,a=a<<17|a>>>15,a=668265263*(a&65535)+(668265263*(a>>>16)<<16)&4294967295;for(;c<b.length;++c)a+=374761393*b[c],a=a<<11|a>>>21,a=2654435761*(a&65535)+(2654435761*(a>>>16)<<16)&4294967295;a^=a>>>15;a=(2246822519*(a&65535)&4294967295)+(2246822519*(a>>>16)<<16);a^=a>>>13;a=(3266489917*(a&65535)&4294967295)+(3266489917*(a>>>16)<<16);a^=a>>>
16;return 0>a?a+4294967296:a}

const textEncoder = new TextEncoder()
function getAnimeColor(name){
  const normalized = textEncoder.encode(name.toLowerCase())
  return tinycolor('#F12')
    .desaturate(xxHash32(normalized.slice(5)) % 50)
    .darken(xxHash32(normalized.slice(1, 4)) % 20)
    .spin((normalized[0] * 14.4) % 360)
}

let isFirstUpdate = true
const trackedSections = new Set()
const observer = window.IntersectionObserver ? new IntersectionObserver(entries => {
  if (isFirstUpdate) entries = entries.filter(e => e.intersectionRatio > 0)
  for (let entry of entries) {
    if (entry.intersectionRatio > 0 && entry.intersectionRatio < 1) {
      trackedSections.add(entry.target)
    } else {
      trackedSections.delete(entry.target)
      entry.target.querySelector('.name').removeAttribute('style')
    }
  }
  isFirstUpdate = false
}, {}) : {
  observe: () => {},
  unobserve: () => {}
}

const app = new Vue({
  el: '.app',
  data: {
    seasons: [],
    annotations: [],
    historyMarks: [],
    lastPushed: null,
    sidebar: null,
    recommendedAnime: '',
    recommendedMessage: '',
    recommendedWorking: false
  },
  created: function () {
    this.fetchData()
  },
  directives: {
    'handle-intersection': {
      inserted: function (el, options) {
        if (options.value.active) {
          observer.observe(el)
        }
      },
      unbind: function (el, options) {
        if (options.value.active) {
          observer.unobserve(el)
        }
      }
    }
  },
  computed: {
    lastRow () {
      return this.seasons.reduce((max, season) => Math.max(max, season.orderIndex), 0)
    }
  },
  methods: {
    async fetchData (options = {}) {
      const data = await fetch('seasons.json').then(data => data.json())
      this.seasons = data.seasons
      this.annotations = data.annotations
      this.historyMarks = data.historyMarks
      this.organize()
      this.getLastEntry()
      setTimeout(this.handleScroll, 20)
    },
    async getLastEntryData () {
      const cacheTimestamp = +localStorage['animestats_cache_timestamp']
      const cachedData = localStorage['animestats_cache']
      const maxTimestamp = Date.now() - 8 * 60 * 60 * 1000
      if (cacheTimestamp && cacheTimestamp > maxTimestamp) {
        return JSON.parse(cachedData)
      }

      const response = await fetch('https://api.jsonbin.io/b/6068ed6ac4f0ae7e081b3cd6/latest')
      if (!response.ok) {
        if (cachedData) return JSON.parse(cachedData)
        throw Error('Got HTTP error!')
      }
      const data = await response.json()

      localStorage['animestats_cache'] = JSON.stringify(data)
      localStorage['animestats_cache_timestamp'] = Date.now()
      return data
    },
    async getLastEntry () {
      const data = await this.getLastEntryData()
      let lastEntryEpisode = Number(data.lastEntryEpisode)
      const lastEntryId = Number(data.lastEntryId)
      if (!lastEntryId) return

      const lastSeason = this.seasons.filter(e => {
        return e.animeId === lastEntryId &&
          e.firstEpisode <= lastEntryEpisode &&
          e.firstEpisode + e.episodeCount > lastEntryEpisode
      }).pop()
      if (!lastSeason) return

      if (lastSeason.episodesPerLoop) {
        lastEntryEpisode = Math.floor(lastEntryEpisode / lastSeason.episodesPerLoop)
      }

      this.lastPushed = [
        lastSeason.start + (lastEntryEpisode - lastSeason.firstEpisode) * ((lastSeason.skipPerLoop || 0) + 1),
        lastSeason.orderIndex
      ]

      setTimeout(() => {
        const el = this.$refs.seasonArea
        el.scrollLeft = this.lastPushed[0] * 25 - 150
        el.addEventListener('wheel', e => {
          if (e.ctrlKey) return
          const delta = Math.sign(e.deltaY) * 55
          e.preventDefault()
          if (e.shiftKey) {
            el.scrollTop += delta
          } else {
            el.scrollLeft += delta
          }
        })
      }, 20)
    },
    organize () {
      this.seasons.forEach(season => {
        const baseColor = getAnimeColor(season.anime)
        season.bgColor = baseColor.toString()
        season.textColor = season.skipPerLoop || baseColor.getLuminance() > 0.5 ? 'black' : 'white'
        season.bgColorAlt = tinycolor.mix('white', baseColor, 25).toString()

        if (!season.skipPerLoop) season.skipPerLoop = 0
        if (!season.episodesPerLoop) season.episodesPerLoop = 1

        const episodes = season.episodeCount - season.firstEpisode + 1
        season.loops = Math.ceil((episodes + (episodes - 1) * season.skipPerLoop) / season.episodesPerLoop)
        season.textSize = Math.round(season.anime.length / 2.7)
      })

      const deltaY = CSS && CSS.supports('-moz-appearance:meterbar') ? 0 : 1
      this.seasons.forEach(season => {
        season.labelPosition = this.getLabelPosition(season)
        const textShadow = season.skipPerLoop > 0 &&
          season.labelPosition === 'inside' &&
          '0,1,2,3,4,5,6,7,8'.replace(/\d+/g, e =>
            `${2 * Math.sin(e * Math.PI / 4)}px
            ${2 * Math.cos(e * Math.PI / 4)}px
            ${season.bgColorAlt}`
          )
        season.labelStyle = (season.labelY > 0
          ? 'top:-' + (season.labelY * 25 + deltaY) + 'px'
          : season.labelY < 0
            ? 'bottom:' + (season.labelY * 25 - deltaY) + 'px'
            : ''
        ) + (textShadow ? ';text-shadow:' + textShadow : '')
      })
    },
    getLabelPosition (season) {
      if (season.labelY) return season.labelY > 0 ? 'above' : 'below'
      if (season.loops > season.textSize) return 'inside'

      const hasSpaceAtRight = !this.seasons.find(e =>
        e !== season && e.orderIndex === season.orderIndex &&
        e.start <= season.start + season.loops + season.textSize &&
        e.start >= season.start + season.loops
      )
      if (hasSpaceAtRight) return 'right'

      const hasSpaceAbove = !this.seasons.find(e =>
        e !== season &&
        e.loops < e.textSize &&
        e.orderIndex === season.orderIndex &&
        e.start + season.textSize > season.start &&
        e.start + e.loops <= season.start
      ) && !this.seasons.find(e =>
        e !== season &&
        e.orderIndex === season.orderIndex - 1 &&
        !(e.start > season.start + season.loops || e.start + e.loops < season.start)
      )
      if (hasSpaceAbove) return 'above'

      return 'below'
    },
    handleScroll () {
      const {scrollWidth} = this.$refs.seasonArea.parentNode
      for (let entry of trackedSections) {
        const boundary = entry.getBoundingClientRect()
        const name = entry.querySelector('.name')
        name.style.textAlign = 'center'
        name.style.position = 'fixed'
        name.style.left = Math.max(0, boundary.left + 30) + 'px'
        name.style.right = Math.max(0, scrollWidth - boundary.right + 30) + 'px'
        name.style.top = boundary.top + 'px'
      }
    },
    async sendRecommendedAnime () {
      const query = window.encodeURIComponent(this.recommendedAnime.trim())
      if (query.length === 0) {
        this.recommendedMessage = 'Escreva alguma coisa antes de apertar o botão!'
        return
      }
      if (query.length < 2) {
        this.recommendedMessage = 'Esse anime não tem um nome maior não? Fica difícil pesquisar assim.'
        return
      }
      if (query.length > 50) {
        this.recommendedMessage = 'O nome desse anime é tão grande assim? Daria para abreviar, por favor?'
        return
      }

      const lastRecommendedTimestamp = +localStorage['animestats_recommended_timestamp']
      const minTimestamp = Date.now() - 30 * 1000
      if (lastRecommendedTimestamp && lastRecommendedTimestamp > minTimestamp) {
        this.recommendedMessage = 'Calma aí, vá mais devagar!'
        return
      }
      localStorage['animestats_recommended_timestamp'] = Date.now()

      this.recommendedWorking = true
      const response = await fetch('https://api.jikan.moe/v3/search/anime?q=' + query).catch(() => null)
      if (!response || !response.ok) {
        this.recommendedWorking = false
        this.recommendedMessage = 'Servidor fora do ar. Tente novamente mais tarde.'
        return
      }

      const data = await response.json()
      const anime = data.results[0]
      if (!anime) {
        this.recommendedWorking = false
        this.recommendedMessage = 'Anime não encontrado. Tente novamente.'
        return
      }

      const alreadyInPlan = this.seasons.find(e => e.animeId === anime.mal_id)
      if (alreadyInPlan) {
        this.recommendedWorking = false
        this.recommendedMessage = 'Esse anime já está no planejamento!'
        return
      }

      const isBlacklisted = recommendedBlacklist.includes(anime.mal_id)
      if (!isBlacklisted && anime.rated === 'Rx') {
        this.recommendedWorking = false
        this.recommendedMessage = 'Sem sugestões de hentai, por favor.'
        return
      }

      if (!isBlacklisted) {
        const response = await fetch('https://jsonbox.io/qgustavor_anime_stats', {
          method: 'post',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            name: this.recommendedAnime,
            id: anime.mal_id
          })
        })
        if (!response.ok) {
          this.recommendedWorking = false
          this.recommendedMessage = 'Servidor fora do ar. Tente novamente mais tarde.'
          return
        }
      }

      this.recommendedWorking = false
      this.recommendedAnime = ''
      this.sidebar = null
    }
  }
})

const recommendedBlacklist = [1639]
