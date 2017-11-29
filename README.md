# Remote Redux

Remote redux eliminates the need for complex server-side apis and api bindings
by combining the redux state machine on the client with the server.

Example Usage:
```javascript
import { createStore, applyMiddleware } from 'redux'
import { remoteReduxMiddleware, remoteReduxWrapReducer } from 'remote-redux'

function localReducer(state, action) {
  if (action.type === 'INCREASE_COUNTER') {
    return { counter: state.counter + 1 }
  }
  return state
}

function makeRequest(state, action, callback) {
  fetch('/api/apply-action', { payload: { state, action }}).then(callback)
}

function detectRemoteAction(action) {
  return action.remote
}

const reducer = remoteReduxWrapReducer(localReducer)

const store = createStore(
  reducer,
  { counter: 0 },
  applyMiddleware(
    // ...your middlewares
    remoteReduxMiddleware(makeRequest, detectRemoteAction, reducer)
  )
)

store.dispatch({ type: 'LOAD_COUNTER', remote: true })
// the server will eventually return a new state: { counter: 5 }

store.dispatch({ type: 'INCREASE_COUNTER' })
// state: { counter: 1 } (before the counter is loaded)
// state: { counter: 6 } (after the counter is loaded)
```

## Predictive Reduction

Redux requires that actions be applied in order. This would mean that we have to
until remote actions complete to apply local actions. This can have a negative
impact on the user experience e.g. they can't hit back while a page is loading.

To eliminate the delay of user actions, we can use *predictive reduction*.
With predictive reduction, you apply local actions immediately, then revert them
as remote actions finish *only if they had caused an invalid state*. For more
information, check out [this blog post](https://medium.com/@seveibar/remote-reducers-and-predictive-reduction-572ab5054211).

```javascript
import { createStore, applyMiddleware } from 'redux'
import remoteReduxMiddleware from 'remote-redux'

function localReducer(state, action) {
  if (action.type === 'INCREASE_COUNTER') {
    return { counter: state.counter + 1 }
  }
  if (action.type === 'INCREASE_COUNTER_IF_BELOW_5') {
    if (state.counter < 5) {
      return { counter: state.counter + 1 }
    }
  }
  return state
}

function makeRequest(state, action, callback) {
  fetch('/api/apply-action', { payload: { state, action }}).then(callback)
}

function detectRemoteAction(action) {
  return action.remote
}

const store = createStore(
  localReducer,
  { counter: 0 },
  applyMiddleware(remoteReduxMiddleware(makeRequest, detectRemoteAction))
)

store.dispatch({ type: 'INCREASE_COUNTER' })
store.dispatch({ type: 'INCREASE_COUNTER' })
store.dispatch({ type: 'INCREASE_COUNTER' })
// state: { counter: 3 }

store.dispatch({ type: 'DOUBLE_COUNTER', remote: true })
// the server will return a new state: { counter: 6 }

store.dispatch({ type: 'INCREASE_COUNTER_IF_BELOW_5' })
// initially increases the counter (to 4), then reverts the action when it is
// found that the DOUBLE_COUNTER action had made the counter 6
```
