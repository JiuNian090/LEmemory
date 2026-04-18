Component({
  properties: {
    front: {
      type: String,
      value: ''
    },
    back: {
      type: String,
      value: ''
    }
  },
  data: {
    isFlipped: false
  },
  methods: {
    flip() {
      this.setData({
        isFlipped: !this.data.isFlipped
      })
    }
  }
})
