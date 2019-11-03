var ADLER32_MOD=65521;
function adler32(data){var a=1;var b=0;for(var i=0;i<data.length;i++){a=(a+ data.charCodeAt(i))%ADLER32_MOD;b=(b+ a)%ADLER32_MOD;}
return a|(b<<16);}
function getAnimeColor(name){var normalized=name.toLowerCase();return tinycolor('#F11').desaturate(adler32(normalized.substr(5))%30).darken(adler32(normalized.substr(1,4))%20).spin((normalized.charCodeAt(0)*14.4)%360);}

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
    lastPushed: null
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
    fetchData (options = {}) {
      fetch('seasons.json')
      .then(data => data.json())
      .then(data => {
        this.seasons = data.seasons
        this.organize()
        setTimeout(this.handleScroll, 20)

        const lastEntryEpisode = data.lastEntryEpisode
        const lastEntryId = data.lastEntryId

        const lastSeason = data.seasons.filter(e => {
          return e.animeId === lastEntryId &&
            e.firstEpisode <= lastEntryEpisode &&
            e.firstEpisode + e.episodeCount > lastEntryEpisode
        }).pop()
        if (!lastSeason) return

        this.lastPushed = [
          lastSeason.start + lastEntryEpisode - 1,
          lastSeason.orderIndex
        ]

        setTimeout(() => {
          this.$refs.seasonArea.scrollLeft = this.lastPushed[0] * 25 - 150
        }, 20)
      })
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

      this.seasons.forEach(season => {
        season.labelPosition = this.getLabelPosition(season)
      })
    },
    getLabelPosition (season) {
      if (season.loops > season.textSize) return 'inside'

      const hasSpaceAtRight = !this.seasons.find(e =>
        e !== season && e.orderIndex === season.orderIndex &&
        e.start <= season.start + season.loops + season.textSize &&
        e.start >= season.start + season.loops
      )
      if (hasSpaceAtRight) return 'right'

      const hasSpaceAbove = !this.seasons.find(e =>
        e !== season && e.loops < season.textSize && e.orderIndex === season.orderIndex &&
        e.start + season.textSize > season.start &&
        e.start + e.loops <= season.start
      ) && !this.seasons.find(e =>
        e !== season && e.orderIndex === season.orderIndex - 1 &&
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
    }
  }
})
