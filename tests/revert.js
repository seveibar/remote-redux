// @flow weak

var test = require('tape')
const { createStore, applyMiddleware } = require('redux')
const { remoteReduxMiddleware, remoteReduxWrapReducer } = require('../')
const { localReducer, remoteReducer } = require('./common')

function makeRequest(state, action, callback) {
  setTimeout(() => {
    callback(remoteReducer(state, action))
  }, 100)
}

function detectRemoteAction(action) {
  return action.remote || action.type.startsWith('REMOTE_')
}

const reducer = remoteReduxWrapReducer(localReducer)

test('remote reduce revert prior', t => {
  const store = createStore(
    reducer,
    { counter: 0 },
    applyMiddleware(
      remoteReduxMiddleware(makeRequest, detectRemoteAction, reducer)
    )
  )
  t.plan(4)

  store.dispatch({ type: 'INCREASE_COUNTER' })
  store.dispatch({ type: 'INCREASE_COUNTER' })
  store.dispatch({ type: 'INCREASE_COUNTER' })
  t.deepEqual(store.getState(), { counter: 3 })
  // state: { counter: 3 }

  store.dispatch({ type: 'DOUBLE_COUNTER', remote: true })
  t.deepEqual(store.getState(), { counter: 3 })
  // the server will eventually return a new state: { counter: 6 }

  store.dispatch({ type: 'INCREASE_COUNTER_IF_BELOW_5' })
  t.deepEqual(store.getState(), { counter: 4 })
  // initially increases the counter (to 4), then reverts the action when it is
  // found that the DOUBLE_COUNTER action had made the counter 6
  setTimeout(() => {
    t.deepEqual({ counter: 6 }, store.getState())
  }, 200)
})
