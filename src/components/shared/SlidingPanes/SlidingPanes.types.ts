export interface SlidingPanesProps {
    /**
     * The panes, in the order they sit on the track — which is also the order they are stepped
     * through, since the track slides by whole panes.
     *
     * Every entry names the slot that fills it, so a pane called `SUCCESS` is drawn by
     * `<template #SUCCESS>`.
     */
    panes: readonly string[];
    /** Which pane is on screen. One of `panes`; anything else leaves the track where it is. */
    current: string;
}
