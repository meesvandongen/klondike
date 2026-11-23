package main

import "testing"

func TestGameFor(t *testing.T) {
	for _, tc := range []struct{ appName, env, want string }{
		{"Klondike", "", "klondike"},
		{"FreeCell Dev", "", "freecell"},
		{"TriPeaks", "", "tripeaks"},
		{"hearts", "", "hearts"}, // `go run` names the app after the executable
		{"solitaire", "spider", "spider"},
		{"Pyramid", "", "pyramid"},
		{"something-else", "", "klondike"},
	} {
		if got := gameFor(tc.appName, tc.env).key; got != tc.want {
			t.Errorf("gameFor(%q, %q) = %q, want %q", tc.appName, tc.env, got, tc.want)
		}
	}
}

func TestMenuItems(t *testing.T) {
	ids := func(g game) map[string]bool {
		set := map[string]bool{}
		m := (&Menu{}).build(g)
		for _, top := range m.Items() {
			for _, it := range top.Submenu {
				if it.ID != "" {
					set[it.ID] = true
				}
			}
		}
		return set
	}
	k := ids(gameFor("Klondike", ""))
	for _, id := range []string{"new-game", "undo", "hint", "auto-complete", "draw-1", "draw-3", "zoom-in", "about"} {
		if !k[id] {
			t.Errorf("Klondike menu lacks %q", id)
		}
	}
	h := ids(gameFor("Hearts", ""))
	for _, id := range []string{"hint", "auto-complete", "draw-1"} {
		if h[id] {
			t.Errorf("Hearts menu has %q", id)
		}
	}
}
