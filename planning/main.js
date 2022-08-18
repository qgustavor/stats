import xxHash32 from 'https://unpkg.com/xxh32@1.4.0/dist/index.bundle.js'
import Color from 'https://colorjs.io/dist/color.js'

const textEncoder = new TextEncoder()
function getAnimeColor (name) {
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
    genres: [],
    lastPushed: null,
    sidebar: null,
    recommendedAnime: '',
    recommendedMessage: '',
    recommendedWorking: false,
    animelist: 'anilist',
    colorMode: 'name',
    reccomendationEndpoint: 'https://krat.es/15ab70e37a257b58a094',
    isGecko: navigator.userAgent.includes('Gecko/')
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
      this.genres = data.genres
      this.organize()
      const baseScrollPos = await this.getLastEntry()
      this.setUpScrolling(baseScrollPos)
      setTimeout(this.handleScroll, 20)
      for (const genre of this.genres) {
        genre.textColor = new Color(genre.color).to('lab').lab.l > 50 ? 'black' : 'white'
      }
    },
    async getLastEntryData () {
      const cacheTimestamp = +localStorage['animestats_cache_timestamp']
      const cachedData = localStorage['animestats_cache']
      const maxTimestamp = Date.now() - 8 * 60 * 60 * 1000
      if (cacheTimestamp && cacheTimestamp > maxTimestamp) {
        return JSON.parse(cachedData)
      }

      const response = await fetch('https://api.jsonbin.io/v3/b/6068ed6ac4f0ae7e081b3cd6/latest')
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
      let lastEntryEpisode = Number(data.record.lastEntryEpisode)
      const lastEntryId = Number(data.record.lastEntryId)
      if (!lastEntryId) return

      const lastSeason = this.seasons.filter(e => {
        return e.animeId === lastEntryId &&
          e.firstEpisode <= lastEntryEpisode &&
          e.episodeCount >= lastEntryEpisode
      }).pop()
      if (!lastSeason) return

      if (lastSeason.episodesPerLoop) {
        lastEntryEpisode = Math.floor(lastEntryEpisode / lastSeason.episodesPerLoop)
      }

      this.lastPushed = [
        lastSeason.start + (lastEntryEpisode - lastSeason.firstEpisode) *
          ((lastSeason.skipPerLoop || 0) + 1),
        lastSeason.orderIndex
      ]

      return this.lastPushed[0] * 25 - 150
    },
    setUpScrolling (baseScroll) {
      setTimeout(() => {
        const el = this.$refs.seasonArea
        if (baseScroll) el.scrollLeft = baseScroll
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
        const mainGenre = season.genres
          ? this.genres.find(e => season.genres.includes(e.id))
          : null

        let baseColor
        if (this.colorMode === 'name') {
          baseColor = getAnimeColor(season.anime)
        } else {
          baseColor = tinycolor(mainGenre ? mainGenre.color : 'gray')
        }

        season.bgColor = baseColor.toString()
        season.textColor = season.skipPerLoop ||
          new Color(season.bgColor).to('lab').lab.l > 50 ? 'black' : 'white'
        season.bgColorAlt = tinycolor.mix('white', baseColor, 25).toString()

        if (season.genres) {
          season.genreNames = this.genres
            .filter(e => season.genres.includes(e.id))
            .map(e => e.name)
            .join(', ') || 'Gêneros desconhecidos'
        } else {
          season.genreNames = 'Isso não é um anime ou não está cadastrado no AniList'
        }

        if (!season.skipPerLoop) season.skipPerLoop = 0
        if (!season.episodesPerLoop) season.episodesPerLoop = 1

        const episodes = season.episodeCount - season.firstEpisode + 1
        season.loops = Math.ceil((episodes + (episodes - 1) * season.skipPerLoop) / season.episodesPerLoop)
        season.textSize = Math.round(season.anime.length / 2.7)
      })

      const deltaY = this.isGecko ? 0 : 1
      this.seasons.forEach(season => {
        season.labelPosition = this.getLabelPosition(season)
        let textShadow = ''
        if (season.skipPerLoop > 0 && season.labelPosition === 'inside') {
          for (let i = 0; i < 16; i++) {
            const d = Math.floor(i / 8) + 2
            textShadow += `,${Math.round(d * Math.sin(i * Math.PI / 4))}px ${Math.round(d * Math.cos(i * Math.PI / 4))}px ${season.bgColorAlt}`
          }
          textShadow = textShadow.slice(1)
        }
        season.labelStyle = (season.labelY > 0
          ? 'top:-' + (season.labelY * 25 - deltaY) + 'px'
          : season.labelY < 0
            ? 'bottom:' + (season.labelY * 25 - deltaY) + 'px'
            : ''
        ) + (textShadow ? ';text-shadow:' + textShadow : '')
      })

      this.updateAnimeUrls()
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
      const response = await fetch('https://api.jikan.moe/v4/anime?q=' + query).catch(() => null)
      if (!response || !response.ok) {
        this.recommendedWorking = false
        this.recommendedMessage = 'Servidor fora do ar. Tente novamente mais tarde.'
        return
      }

      const data = await response.json()
      const anime = data.data[0]
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
      if (!isBlacklisted && anime.rating && anime.rating.includes('Hentai')) {
        this.recommendedWorking = false
        this.recommendedMessage = 'Sem sugestões de hentai, por favor.'
        return
      }

      if (!isBlacklisted) {
        const response = await fetch(this.reccomendationEndpoint, {
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
    },
    updateAnimeUrls () {
      for (const season of this.seasons) {
        season.url = this.getAnimeUrl(season)
      }
    },
    getAnimeUrl (season) {
      if (this.animelist === 'anilist' && season.anilistId) {
        return 'https://anilist.co/anime/' + season.anilistId
      }
      if (!season.animeId) return
      if (typeof season.animeId === 'string') {
        if (season.animeId.startsWith('AL-')) {
          return 'https://anilist.co/anime/' + season.animeId.slice(3)
        }
        if (season.animeId.startsWith('MDL-')) {
          return 'https://mydramalist.com/' + season.animeId.slice(4)
        }
        if (season.animeId.startsWith('KITSU-')) {
          return 'https://kitsu.io/anime/' + season.animeId.slice(6)
        }
      }
      return 'https://myanimelist.net/anime/' + season.animeId
    }
  }
})

const recommendedBlacklist = [1639]
