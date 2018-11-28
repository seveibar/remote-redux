// @flow weak

// We have a Fast Store and a True Store. The True Store is kept in the
// middleware, the Fast Store is the user-defined store that the middleware
// intercepts.

const _isEqual = require("lodash/isEqual")
const redux = require("redux")

// Helper function/main export to make setting up remote redux easier
const remoteRedux = ({
  makeRequest,
  detectRemoteAction,
  applyResponse,
  reducer
}) => {
  let storeParams = {}
  storeParams.reducer = wrapReducer(reducer, applyResponse)
  storeParams.middleware = remoteReduxMiddleware(
    makeRequest,
    detectRemoteAction,
    storeParams.reducer
  )
  return storeParams
}

const remoteReduxMiddleware = (
  makeRequest,
  detectRemoteAction,
  reducer,
  options
) => store => {
  if (!detectRemoteAction) {
    detectRemoteAction = action =>
      action.remote || action.type.startsWith("REMOTE_")
  }
  if (!options) options = { conservative: false }

  // currently we must only execute one remote action at once because of
  // the possibility of mutating server-side actions
  let queuedRemoteActions = []
  let remoteActionInProgress = false

  // Keep track of the actions executed when the true store and fast store were
  // in sync.
  let lastTrueState = store.getState()
  let actionsSinceTrueState = []

  function applyActions(state, actions) {
    if (actions.length === 0) return state
    return applyActions(reducer(state, actions[0]), actions.slice(1))
  }

  return next => action => {
    // When an action comes in we...
    // 1. Check if it's a remote action (if it isn't just pass it along)
    // 2. If a remote action is already in progress, add it to the queue,
    //    otherwise make a request with it (and remove it from the queue if
    //    it's in the queue)
    // 3. When the request completes, dispatch a response action to make the
    //    changes to the state that the server requested
    // 4. Execute any remote actions that are on the queue.

    if (remoteActionInProgress && !action._remoteReduxResponse) {
      actionsSinceTrueState.push(action)
    }

    if (detectRemoteAction(action)) {
      if (remoteActionInProgress) {
        queuedRemoteActions.push(action)
      } else {
        remoteActionInProgress = true
        if (queuedRemoteActions.includes(action)) {
          queuedRemoteActions = queuedRemoteActions.filter(a => a !== action)
        }

        makeRequest(store.getState(), action, response => {
          store.dispatch({
            _remoteReduxResponse: true,
            type: "RESPONSE_" + action.type,
            response
          })
        })
      }
    }

    let newActions = []
    if (action._remoteReduxResponse) {
      // Reconciliation
      const fastStoreState = applyActions(store.getState(), [action])
      const trueStoreState = applyActions(
        lastTrueState,
        // put the actions in correct order
        [action].concat(actionsSinceTrueState)
      )

      let reconciledState
      // TODO check if using this lodash method is still speedy w/ seamless-immutable
      if (_isEqual(fastStoreState, trueStoreState)) {
        reconciledState = fastStoreState
      } else {
        // The order in which the actions are applied effects the state!
        // NOTE: This should happen infrequently
        if (options.conservative) {
          // Undo all the user actions since the remote reduction
          queuedRemoteActions = []
          reconciledState = applyActions(trueStoreState, [action])
        } else {
          reconciledState = trueStoreState
        }
        newActions.push({
          type: "@@remote-redux/RECONCILE",
          newState: reconciledState
        })
      }
      lastTrueState = reconciledState
      actionsSinceTrueState = []

      // We've finished this remote reduction, start another if any are waiting
      remoteActionInProgress = false
      if (queuedRemoteActions.length > 0) {
        newActions.push(queuedRemoteActions[0])
      }
    }
    let result = next(action)
    newActions.forEach(action => {
      store.dispatch(action)
    })
    return result
  }
}

const remoteReduxReducer = applyResponse => {
  if (!applyResponse) {
    applyResponse = (state, action) => action.response
  }
  return (state, action) => {
    if (action._remoteReduxResponse) {
      return applyResponse(state, action)
    }
    if (action.type === "@@remote-redux/RECONCILE") {
      return action.newState
    }
    return state
  }
}

const wrapReducer = (userReducer, applyResponse) => (state, action) => {
  return userReducer(remoteReduxReducer(applyResponse)(state, action), action)
}

const createStore = ({
  reducer,
  initialState,
  middlewares,
  makeRequest,
  detectRemoteAction,
  applyResponse,
  useReduxDevTools
}) => {
  const wrappedReducer = wrapReducer(reducer, applyResponse)

  let compose = redux.compose
  if (useReduxDevTools) {
    compose = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || redux.compose
  }

  const middleware = compose(
    redux.applyMiddleware(
      ...(middlewares || []),
      remoteReduxMiddleware(makeRequest, detectRemoteAction, wrappedReducer)
    )
  )

  return redux.createStore(wrappedReducer, initialState, middleware)
}

module.exports = {
  default: remoteRedux,
  remoteRedux,
  remoteReduxMiddleware,
  remoteReduxReducer,
  remoteReduxWrapReducer: wrapReducer,
  createStore
}
