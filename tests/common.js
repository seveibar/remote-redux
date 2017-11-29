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

function remoteReducer(state, action) {
  if (action.type === 'REMOTE_LOAD_COUNTER' || action.type === 'LOAD_COUNTER') {
    return { counter: 5 }
  }
  if (
    action.type === 'REMOTE_DOUBLE_COUNTER' ||
    action.type === 'DOUBLE_COUNTER'
  ) {
    return { counter: state.counter * 2 }
  }
  return state
}

module.exports = {
  localReducer,
  remoteReducer
}
