// @flow weak

var test = require('tape')
const { createStore, applyMiddleware } = require('redux')
const { remoteReduxMiddleware, remoteReduxWrapReducer } = require('../src')
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

test('remote reduce reapply future', t => {
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

  t.deepEqual({ counter: 1 }, store.getState())

  setTimeout(() => {
    t.deepEqual({ counter: 6 }, store.getState())
  }, 200)
})
