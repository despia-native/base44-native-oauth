// Tiny shared navigation state between SwipeBack, AnimatedRoutes and ScrollMemory.
export const navMotion = {
  // SwipeBack sets this right before navigate(-1) so the router knows the exit
  // was ALREADY animated by the gesture and must not replay a second slide
  // (the replay is what caused the visible flash after swiping back).
  swipeBack: false,
  // The direction of the most recent navigation ('push' | 'back' | 'tab' | 'swipe'),
  // written by AnimatedRoutes — ScrollMemory restores scroll only on back/swipe.
  direction: 'push',
}