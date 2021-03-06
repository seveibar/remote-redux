# Remote Redux

Remote redux eliminates the need for complex server-side apis and api bindings
by combining the redux state machine on the client with the server.

![image](https://user-images.githubusercontent.com/1910070/33395325-1b0d0038-d513-11e7-9f45-57df62f39834.png)

You can see the motivation behind redux-remote in [this blog post](https://medium.com/@seveibar/remote-reducers-and-predictive-reduction-572ab5054211).

Example Usage:

```javascript
import { createStore } from 'remote-redux'

function reducer(state, action) {
  if (action.type === 'INCREASE_COUNTER') {
    return { counter: state.counter + 1 }
  }
  return state
}

function makeRequest(state, action, callback) {
  fetch('/api/apply-action', {
    method: 'POST',
    body: JSON.stringify({ state, action }),
    headers: new Headers({ 'Content-Type': 'application/json' })
  })
    .then(response => response.json())
    .then(response => {
      callback(response.newState)
    })
}

const store = createStore({
  reducer,
  initialState: { counter: 0 },
  middlewares: [],
  makeRequest
})

store.dispatch({ type: 'LOAD_COUNTER', remote: true })
// the server will eventually return a new state: { counter: 5 }

store.dispatch({ type: 'INCREASE_COUNTER' })
// state: { counter: 1 } (before the counter is loaded)
// state: { counter: 6 } (after the counter is loaded)
```

## Using native redux `createStore`

Sometimes you may want to use npm redux module explicitly, this can be done by
calling `remoteReduxMiddleware` and `remoteReduxWrapReducer`.

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
  fetch('/api/apply-action', {
    method: 'POST',
    body: JSON.stringify({ state, action }),
    headers: new Headers({ 'Content-Type': 'application/json' })
  })
    .then(response => response.json())
    .then(response => {
      callback(response.newState)
    })
}

const reducer = remoteReduxWrapReducer(localReducer)

const store = createStore(
  reducer,
  { counter: 0 },
  applyMiddleware(
    // ...your middlewares
    remoteReduxMiddleware(makeRequest, null, reducer)
  )
)

store.dispatch({ type: 'LOAD_COUNTER', remote: true })
// the server will eventually return a new state: { counter: 5 }

store.dispatch({ type: 'INCREASE_COUNTER' })
// state: { counter: 1 } (before the counter is loaded)
// state: { counter: 6 } (after the counter is loaded)
```

## Predictive Reduction

Redux requires that actions be applied in order. This would mean that we would have to
wait until remote actions complete to apply local actions. This can have a negative
impact on the user experience e.g. they can't hit back while a page is loading.

To eliminate the delay of user actions, we can use _predictive reduction_.
With predictive reduction, you apply local actions immediately, then revert them
as remote actions finish _only if they had caused an invalid state_. For more
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
  fetch('/api/apply-action', {
    method: 'POST',
    body: JSON.stringify({ state, action }),
    headers: new Headers({ 'Content-Type': 'application/json' })
  })
    .then(response => response.json())
    .then(response => {
      callback(response.newState)
    })
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

store.dispatch({ type: 'INCREASE_COUNTER' })
store.dispatch({ type: 'INCREASE_COUNTER' })
store.dispatch({ type: 'INCREASE_COUNTER' })
// state: { counter: 3 }

store.dispatch({ type: 'DOUBLE_COUNTER', remote: true })
// the server will eventually return a new state: { counter: 6 }

store.dispatch({ type: 'INCREASE_COUNTER_IF_BELOW_5' })
// initially increases the counter (to 4), then reverts the action when it is
// found that the DOUBLE_COUNTER action had made the counter 6
```
