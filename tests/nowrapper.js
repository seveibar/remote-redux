// @flow weak

var test = require('tape')
const { createStore } = require('../src')
const { localReducer, remoteReducer } = require('./common')

function makeRequest(state, action, callback) {
  setTimeout(() => {
    callback(remoteReducer(state, action))
  }, 100)
}

test('simple configuration', t => {
  const store = createStore({
    reducer: localReducer,
    initialState: { counter: 0 },
    makeRequest
  })

  t.plan(2)
  store.subscribe(action => {
    console.log(store.getState(), action)
  })

  store.dispatch({ type: 'INCREASE_COUNTER' })

  store.dispatch({ type: 'REMOTE_LOAD_COUNTER', remote: true })

  t.deepEqual(store.getState(), { counter: 1 })

  setTimeout(() => {
    t.deepEqual(store.getState(), { counter: 5 })
  }, 200)
})
