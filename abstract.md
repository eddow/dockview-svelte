Building a bridge between **Dockview** (a high-performance, layout-agnostic dock management framework originally built for TypeScript/React) and **Svelte** is an intriguing architectural challenge. Dockview relies heavily on a clean separation between its layout engine/DOM orchestration and the framework-specific components rendered inside its panels.

### Value and Gains

Bringing Dockview into the Svelte ecosystem unlocks a major missing piece for advanced developer tooling, dashboards, and IDE-like web applications written in Svelte.

* **High-Performance Pane Management:** Dockview handles complex window splitting, floating windows, tabs, dragging, dropping, and resizing with incredible smoothness. Building this natively in Svelte with the same robustness would take months of edge-case handling (particularly around pointer events and layout reconciliation).
* **Framework Agnosticism:** Dockview was architected with a core layout engine separate from its UI layer, meaning it doesn't *strictly* require React to function—it manipulates DOM elements and relies on a component rendering contract.
* **First-Class Svelte 5 Integration:** By leveraging Svelte 5's runes (`$state`, `$derived`) and snippet/component architecture, a Svelte wrapper can feel completely native, reactive, and ergonomic, avoiding the awkward lifecycle mapping often seen in React-to-Svelte wrappers.

---

### Technical Difficulties and Hurdles

* **The Rendering Contract:** Dockview needs to mount, update, and unmount views dynamically inside DOM nodes it controls. In React, this is handled via `createPortal` or framework-specific mounting hooks. In Svelte, mounting components imperatively requires `mount` (from `svelte`), which behaves differently across Svelte 4 and Svelte 5.
* **State Preservation on Drag-and-Drop:** When a panel is dragged to a new tab group or docked elsewhere in Dockview, its DOM node is often moved or recreated. If the framework wrapper doesn't intercept this and properly coordinate with Svelte's lifecycle, component state can be unexpectedly reset or component instances destroyed.
* **Event Synchronization:** Dockview emits a torrent of imperative events (e.g., `onDidAddGroup`, `onDidRemovePanel`, `onDidLayoutChange`), which need to be bridged cleanly into Svelte's reactive paradigm without triggering infinite loop re-renders.
* **TypeScript Generics:** Dockview's API is heavily typed around panels, parameters, and view identifiers. Preserving end-to-end type safety for Svelte component props passed through Dockview panel parameters requires careful generic typing.

---

### Architectural Choices and Implementation Strategy

To build this bridge successfully, you have a few structural choices to make regarding how Svelte components interface with Dockview's core API:

* **The Core Engine Approach:** Do not try to rewrite Dockview. Use the `@dockview/dockview` package (in 8.x it is a thin re-export of `dockview-core` and ships the stylesheet; there is no React wrapper), letting you write a pure vanilla/DOM-based controller layer tailored for Svelte.
* **Component Rendering via `mount`:**
Implement a custom Dockview framework helper using Svelte's programmatic mounting API. When Dockview requests a panel to be rendered inside an HTMLElement container:
1. Instantiate the Svelte component using `mount(MyComponent, { target: container, props: ... })`.
2. Keep a map of panel IDs to the returned component instance or unmount handle.
3. Listen to Dockview's `onDidRemovePanel` event to safely call `unmount(instance)` and prevent memory leaks.


* **Handling Reactivity and Props:**
Dockview panels usually accept arbitrary parameters via `params`. In Svelte, these can be passed down as component props. If these parameters change dynamically, the wrapper needs to expose a method or event listener to push updates into the mounted Svelte instance.

## Human description of purpose

- Having a `<Dockview>` component who takes components and configuration (`$state` configuration)
- Defining "widgets" as components
- Allowing widgets to have access to their data (size, ...) through state variables provided to them (like props)
- Finding a way to connect tab-headers and tab-content