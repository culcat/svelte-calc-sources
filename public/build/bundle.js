
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback, value) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            if (value === undefined) {
                callback(component.$$.ctx[index]);
            }
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.55.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\Keypad.svelte generated by Svelte v3.55.0 */
    const file$1 = "src\\Keypad.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let button0;
    	let t1;
    	let button1;
    	let t3;
    	let button2;
    	let t5;
    	let button3;
    	let t7;
    	let button4;
    	let t9;
    	let button5;
    	let t11;
    	let button6;
    	let t13;
    	let button7;
    	let t15;
    	let button8;
    	let t17;
    	let button9;
    	let t19;
    	let br0;
    	let t20;
    	let br1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			button0 = element("button");
    			button0.textContent = "1";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "2";
    			t3 = space();
    			button2 = element("button");
    			button2.textContent = "3";
    			t5 = space();
    			button3 = element("button");
    			button3.textContent = "4";
    			t7 = space();
    			button4 = element("button");
    			button4.textContent = "5";
    			t9 = space();
    			button5 = element("button");
    			button5.textContent = "6";
    			t11 = space();
    			button6 = element("button");
    			button6.textContent = "7";
    			t13 = space();
    			button7 = element("button");
    			button7.textContent = "8";
    			t15 = space();
    			button8 = element("button");
    			button8.textContent = "9";
    			t17 = space();
    			button9 = element("button");
    			button9.textContent = "0";
    			t19 = space();
    			br0 = element("br");
    			t20 = space();
    			br1 = element("br");
    			attr_dev(button0, "class", "svelte-1cfbk94");
    			add_location(button0, file$1, 13, 1, 219);
    			attr_dev(button1, "class", "svelte-1cfbk94");
    			add_location(button1, file$1, 14, 1, 261);
    			attr_dev(button2, "class", "svelte-1cfbk94");
    			add_location(button2, file$1, 15, 1, 303);
    			attr_dev(button3, "class", "svelte-1cfbk94");
    			add_location(button3, file$1, 16, 1, 345);
    			attr_dev(button4, "class", "svelte-1cfbk94");
    			add_location(button4, file$1, 17, 1, 387);
    			attr_dev(button5, "class", "svelte-1cfbk94");
    			add_location(button5, file$1, 18, 1, 429);
    			attr_dev(button6, "class", "svelte-1cfbk94");
    			add_location(button6, file$1, 19, 1, 471);
    			attr_dev(button7, "class", "svelte-1cfbk94");
    			add_location(button7, file$1, 20, 1, 513);
    			attr_dev(button8, "class", "svelte-1cfbk94");
    			add_location(button8, file$1, 21, 1, 555);
    			attr_dev(button9, "class", "zero svelte-1cfbk94");
    			add_location(button9, file$1, 24, 1, 601);
    			add_location(br0, file$1, 27, 4, 663);
    			attr_dev(div, "class", "keypad svelte-1cfbk94");
    			add_location(div, file$1, 11, 0, 194);
    			add_location(br1, file$1, 29, 0, 677);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(div, t1);
    			append_dev(div, button1);
    			append_dev(div, t3);
    			append_dev(div, button2);
    			append_dev(div, t5);
    			append_dev(div, button3);
    			append_dev(div, t7);
    			append_dev(div, button4);
    			append_dev(div, t9);
    			append_dev(div, button5);
    			append_dev(div, t11);
    			append_dev(div, button6);
    			append_dev(div, t13);
    			append_dev(div, button7);
    			append_dev(div, t15);
    			append_dev(div, button8);
    			append_dev(div, t17);
    			append_dev(div, button9);
    			append_dev(div, t19);
    			append_dev(div, br0);
    			insert_dev(target, t20, anchor);
    			insert_dev(target, br1, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*select*/ ctx[0](1), false, false, false),
    					listen_dev(button1, "click", /*select*/ ctx[0](2), false, false, false),
    					listen_dev(button2, "click", /*select*/ ctx[0](3), false, false, false),
    					listen_dev(button3, "click", /*select*/ ctx[0](4), false, false, false),
    					listen_dev(button4, "click", /*select*/ ctx[0](5), false, false, false),
    					listen_dev(button5, "click", /*select*/ ctx[0](6), false, false, false),
    					listen_dev(button6, "click", /*select*/ ctx[0](7), false, false, false),
    					listen_dev(button7, "click", /*select*/ ctx[0](8), false, false, false),
    					listen_dev(button8, "click", /*select*/ ctx[0](9), false, false, false),
    					listen_dev(button9, "click", /*select*/ ctx[0](0), false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t20);
    			if (detaching) detach_dev(br1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Keypad', slots, []);
    	let { value = '' } = $$props;
    	const dispatch = createEventDispatcher();
    	const select = num => () => $$invalidate(1, value += num);
    	const writable_props = ['value'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Keypad> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('value' in $$props) $$invalidate(1, value = $$props.value);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		value,
    		dispatch,
    		select
    	});

    	$$self.$inject_state = $$props => {
    		if ('value' in $$props) $$invalidate(1, value = $$props.value);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [select, value];
    }

    class Keypad extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { value: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Keypad",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get value() {
    		throw new Error("<Keypad>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Keypad>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.55.0 */

    const { console: console_1 } = globals;
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let input0;
    	let t0;
    	let keypad0;
    	let updating_value;
    	let t1;
    	let input1;
    	let t2;
    	let keypad1;
    	let updating_value_1;
    	let t3;
    	let button0;
    	let t5;
    	let button1;
    	let t7;
    	let button2;
    	let t9;
    	let button3;
    	let t11;
    	let br;
    	let t12;
    	let input2;
    	let current;
    	let mounted;
    	let dispose;

    	function keypad0_value_binding(value) {
    		/*keypad0_value_binding*/ ctx[9](value);
    	}

    	let keypad0_props = {};

    	if (/*pin*/ ctx[0] !== void 0) {
    		keypad0_props.value = /*pin*/ ctx[0];
    	}

    	keypad0 = new Keypad({ props: keypad0_props, $$inline: true });
    	binding_callbacks.push(() => bind(keypad0, 'value', keypad0_value_binding, /*pin*/ ctx[0]));
    	keypad0.$on("click", handleSubmit);

    	function keypad1_value_binding(value) {
    		/*keypad1_value_binding*/ ctx[10](value);
    	}

    	let keypad1_props = {};

    	if (/*pin1*/ ctx[1] !== void 0) {
    		keypad1_props.value = /*pin1*/ ctx[1];
    	}

    	keypad1 = new Keypad({ props: keypad1_props, $$inline: true });
    	binding_callbacks.push(() => bind(keypad1, 'value', keypad1_value_binding, /*pin1*/ ctx[1]));
    	keypad1.$on("click", handleSubmit);

    	const block = {
    		c: function create() {
    			input0 = element("input");
    			t0 = space();
    			create_component(keypad0.$$.fragment);
    			t1 = space();
    			input1 = element("input");
    			t2 = space();
    			create_component(keypad1.$$.fragment);
    			t3 = space();
    			button0 = element("button");
    			button0.textContent = "+";
    			t5 = space();
    			button1 = element("button");
    			button1.textContent = "-";
    			t7 = space();
    			button2 = element("button");
    			button2.textContent = "*";
    			t9 = space();
    			button3 = element("button");
    			button3.textContent = "/";
    			t11 = space();
    			br = element("br");
    			t12 = space();
    			input2 = element("input");
    			attr_dev(input0, "class", "input1");
    			set_style(input0, "color", /*pin*/ ctx[0] ? '#333' : '#ccc');
    			input0.value = /*view*/ ctx[4];
    			add_location(input0, file, 44, 0, 808);
    			attr_dev(input1, "class", "input2");
    			set_style(input1, "color", /*pin1*/ ctx[1] ? '#333' : '#ccc');
    			input1.value = /*view1*/ ctx[3];
    			add_location(input1, file, 47, 0, 935);
    			add_location(button0, file, 51, 0, 1066);
    			add_location(button1, file, 52, 0, 1106);
    			add_location(button2, file, 53, 0, 1148);
    			add_location(button3, file, 54, 0, 1189);
    			add_location(br, file, 55, 0, 1229);
    			attr_dev(input2, "type", "text");
    			input2.value = /*sum*/ ctx[2];
    			attr_dev(input2, "class", "sum");
    			add_location(input2, file, 56, 0, 1234);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input0, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(keypad0, target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, input1, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(keypad1, target, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, button2, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button3, anchor);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t12, anchor);
    			insert_dev(target, input2, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*handleSum*/ ctx[5], false, false, false),
    					listen_dev(button1, "click", /*handleMinus*/ ctx[6], false, false, false),
    					listen_dev(button2, "click", /*handleUmno*/ ctx[7], false, false, false),
    					listen_dev(button3, "click", /*handleDel*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*pin*/ 1) {
    				set_style(input0, "color", /*pin*/ ctx[0] ? '#333' : '#ccc');
    			}

    			if (!current || dirty & /*view*/ 16 && input0.value !== /*view*/ ctx[4]) {
    				prop_dev(input0, "value", /*view*/ ctx[4]);
    			}

    			const keypad0_changes = {};

    			if (!updating_value && dirty & /*pin*/ 1) {
    				updating_value = true;
    				keypad0_changes.value = /*pin*/ ctx[0];
    				add_flush_callback(() => updating_value = false);
    			}

    			keypad0.$set(keypad0_changes);

    			if (!current || dirty & /*pin1*/ 2) {
    				set_style(input1, "color", /*pin1*/ ctx[1] ? '#333' : '#ccc');
    			}

    			if (!current || dirty & /*view1*/ 8 && input1.value !== /*view1*/ ctx[3]) {
    				prop_dev(input1, "value", /*view1*/ ctx[3]);
    			}

    			const keypad1_changes = {};

    			if (!updating_value_1 && dirty & /*pin1*/ 2) {
    				updating_value_1 = true;
    				keypad1_changes.value = /*pin1*/ ctx[1];
    				add_flush_callback(() => updating_value_1 = false);
    			}

    			keypad1.$set(keypad1_changes);

    			if (!current || dirty & /*sum*/ 4 && input2.value !== /*sum*/ ctx[2]) {
    				prop_dev(input2, "value", /*sum*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(keypad0.$$.fragment, local);
    			transition_in(keypad1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(keypad0.$$.fragment, local);
    			transition_out(keypad1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input0);
    			if (detaching) detach_dev(t0);
    			destroy_component(keypad0, detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(input1);
    			if (detaching) detach_dev(t2);
    			destroy_component(keypad1, detaching);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(button2);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button3);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t12);
    			if (detaching) detach_dev(input2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function handleSubmit() {
    	
    }

    function instance($$self, $$props, $$invalidate) {
    	let view;
    	let view1;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let chislo1 = 0;
    	let chislo2 = 0;
    	let pin;
    	let pin1;
    	let sum;

    	function handleSum() {
    		chislo1 = pin;
    		console.log(chislo1);
    		chislo2 = pin1;
    		console.log(chislo2);
    		$$invalidate(2, sum = Number(chislo1) + Number(chislo2));
    	}

    	function handleMinus() {
    		chislo1 = pin;
    		console.log(chislo1);
    		chislo2 = pin1;
    		console.log(chislo2);
    		$$invalidate(2, sum = Number(chislo1) - Number(chislo2));
    	}

    	function handleUmno() {
    		chislo1 = pin;
    		console.log(chislo1);
    		chislo2 = pin1;
    		console.log(chislo2);
    		$$invalidate(2, sum = Number(chislo1) * Number(chislo2));
    	}

    	function handleDel() {
    		chislo1 = pin;
    		console.log(chislo1);
    		chislo2 = pin1;
    		console.log(chislo2);
    		$$invalidate(2, sum = Number(chislo1) / Number(chislo2));
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function keypad0_value_binding(value) {
    		pin = value;
    		$$invalidate(0, pin);
    	}

    	function keypad1_value_binding(value) {
    		pin1 = value;
    		$$invalidate(1, pin1);
    	}

    	$$self.$capture_state = () => ({
    		Keypad,
    		chislo1,
    		chislo2,
    		pin,
    		pin1,
    		sum,
    		handleSubmit,
    		handleSum,
    		handleMinus,
    		handleUmno,
    		handleDel,
    		view1,
    		view
    	});

    	$$self.$inject_state = $$props => {
    		if ('chislo1' in $$props) chislo1 = $$props.chislo1;
    		if ('chislo2' in $$props) chislo2 = $$props.chislo2;
    		if ('pin' in $$props) $$invalidate(0, pin = $$props.pin);
    		if ('pin1' in $$props) $$invalidate(1, pin1 = $$props.pin1);
    		if ('sum' in $$props) $$invalidate(2, sum = $$props.sum);
    		if ('view1' in $$props) $$invalidate(3, view1 = $$props.view1);
    		if ('view' in $$props) $$invalidate(4, view = $$props.view);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*pin*/ 1) {
    			$$invalidate(4, view = pin ? pin : 'введите число 1');
    		}

    		if ($$self.$$.dirty & /*pin1*/ 2) {
    			$$invalidate(3, view1 = pin1 ? pin1 : 'введите число 2');
    		}
    	};

    	return [
    		pin,
    		pin1,
    		sum,
    		view1,
    		view,
    		handleSum,
    		handleMinus,
    		handleUmno,
    		handleDel,
    		keypad0_value_binding,
    		keypad1_value_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
