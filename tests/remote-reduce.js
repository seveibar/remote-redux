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

  t.plan(2)

  store.dispatch({ type: 'INCREASE_COUNTER' })

  store.dispatch({ type: 'REMOTE_LOAD_COUNTER', remote: true })

  t.deepEqual(store.getState(), { counter: 1 })

  setTimeout(() => {
    t.deepEqual(store.getState(), { counter: 5 })
  }, 200)
})

// In this test case, remote redux might be considered unreasonably safe, after
// all, the action to increase the counter could still be applied after the
// remote load. TODO Later, you'll be able to enable "reapply" as a
// parameter- but this should come up infrequently so it's probably nbd
test('remote reduce revert future', t => {
  const store = createStore(
    reducer,
    { counter: 0 },
    applyMiddleware(
      remoteReduxMiddleware(makeRequest, detectRemoteAction, reducer)
    )
  )

  t.plan(2)

  store.dispatch({ type: 'REMOTE_LOAD_COUNTER', remote: true })

  store.dispatch({ type: 'INCREASE_COUNTER' })

  t.deepEqual(store.getState(), { counter: 1 })

  setTimeout(() => {
    t.deepEqual(store.getState(), { counter: 5 })
  }, 200)
})
