
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('wordsInput');
    const parseBtn = document.getElementById('parseBtn');
    const clearBtn = document.getElementById('clearBtn');
    const sourceArea = document.getElementById('sourceArea');
    const targetArea = document.getElementById('targetArea');
    const display = document.getElementById('displayWord');

    const MOVE_THRESHOLD = 6;

    function randomPastel() {
        const r = Math.round((Math.random() * 127) + 100);
        const g = Math.round((Math.random() * 127) + 100);
        const b = Math.round((Math.random() * 127) + 100);
        return `rgb(${r},${g},${b})`;
    }

    function textColorForBg(bg) {
        const m = bg && bg.match ? bg.match(/\d+/g) : null;
        if (!m) return '#fff';
        const nums = m.map(Number);
        const brightness = (nums[0]*299 + nums[1]*587 + nums[2]*114) / 1000;
        return brightness > 150 ? '#222' : '#fff';
    }

    function clamp(v, a, b) { 
        return Math.max(a, Math.min(b, v)); 
    }

    function rectsOverlap(r1, r2) {
        return !(r1.left + r1.width <= r2.left ||
                 r2.left + r2.width <= r1.left ||
                 r1.top + r1.height <= r2.top ||
                 r2.top + r2.height <= r1.top);
    }

    function parseInput(str) {
        if (!str || !str.trim()) return [];
        const parts = str.split(/\s*-\s*/).map(s => s.trim()).filter(s => s.length > 0);

        const lower = [], upper = [], nums = [];
        
        for (const token of parts) {
            const first = token.charAt(0);
            const isLetter = /\p{L}/u.test(first);
            
            if (isLetter) {
                if (first === first.toLowerCase()) {
                    lower.push(token);
                } else {
                    upper.push(token);
                }
            } else {
                nums.push(token);
            }
        }

        lower.sort((a, b) => a.localeCompare(b, 'ru', {sensitivity: 'base'}));
        upper.sort((a, b) => a.localeCompare(b, 'ru', {sensitivity: 'base'}));
        nums.sort((a, b) => {
            const ai = parseFloat(a), bi = parseFloat(b);
            if (!isNaN(ai) && !isNaN(bi)) return ai - bi;
            if (!isNaN(ai)) return -1;
            if (!isNaN(bi)) return 1;
            return a.localeCompare(b, 'ru', {sensitivity: 'base'});
        });

        const result = [];
        lower.forEach((w, i) => result.push({key: `a${i+1}`, text: w, group: 'lower'}));
        upper.forEach((w, i) => result.push({key: `b${i+1}`, text: w, group: 'upper'}));
        nums.forEach((w, i) => result.push({key: `n${i+1}`, text: w, group: 'num'}));
        
        return result;
    }

    function createWordElement(item, index) {
        const el = document.createElement('div');
        el.className = 'word-item';
        el.setAttribute('draggable', 'false');

        const label = `${item.key} ${item.text}`;
        el.textContent = label;
        el.dataset.key = item.key;
        el.dataset.group = item.group;
        el.dataset.sortedIndex = index;
        el.dataset.origText = item.text;
        
        const color = randomPastel();
        el.dataset.initialColor = color;
        el.dataset.onTarget = 'false';

        el.style.background = '#bdbdbd';
        el.style.color = '#111';

        el.addEventListener('pointerdown', onPointerDown);
        return el;
    }

    let dragState = null;

    function onPointerDown(e) {
        if (e.button && e.button !== 0) return;
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);

        const rect = el.getBoundingClientRect();
        const originZone = el.closest('.drop-area')?.dataset.zone || 'source';
        const originalNextSibling = (originZone === 'source') ? el.nextElementSibling : null;
        const originalParent = el.parentElement;

        dragState = {
            el,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            initiated: false,
            originZone,
            originalParent,
            originalNextSibling,
            offsetX: 0,
            offsetY: 0,
            startRect: rect
        };

        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerUp);
    }

    function initiateDrag(e) {
        if (!dragState) return;
        const el = dragState.el;
        const rect = dragState.startRect || el.getBoundingClientRect();
        
        el.style.width = rect.width + 'px';
        el.style.height = rect.height + 'px';
        el.style.position = 'absolute';
        el.style.left = (rect.left + window.scrollX) + 'px';
        el.style.top = (rect.top + window.scrollY) + 'px';
        el.style.zIndex = 9999;
        el.classList.add('dragging');

        dragState.offsetX = dragState.startX - rect.left;
        dragState.offsetY = dragState.startY - rect.top;

        document.body.appendChild(el);
        dragState.initiated = true;
    }

    function onPointerMove(e) {
        if (!dragState || e.pointerId !== dragState.pointerId) return;
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        const distSq = dx * dx + dy * dy;

        if (!dragState.initiated) {
            if (Math.sqrt(distSq) >= MOVE_THRESHOLD) {
                initiateDrag(e);
            } else {
                return;
            }
        }

        const el = dragState.el;
        const x = e.clientX - dragState.offsetX + window.scrollX;
        const y = e.clientY - dragState.offsetY + window.scrollY;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
    }

    function placeWithoutOverlap(el, desiredLeft, desiredTop, container) {
        const others = Array.from(container.querySelectorAll('.word-item')).filter(x => x !== el);
        const elWidth = el.offsetWidth;
        const elHeight = el.offsetHeight;

        function isFree(l, t) {
            const r1 = { left: l, top: t, width: elWidth, height: elHeight };
            for (const o of others) {
                const ox = parseFloat(o.style.left) || 0;
                const oy = parseFloat(o.style.top) || 0;
                const r2 = { left: ox, top: oy, width: o.offsetWidth, height: o.offsetHeight };
                if (rectsOverlap(r1, r2)) return false;
            }
            return true;
        }

        const maxLeft = Math.max(0, container.clientWidth - elWidth);
        const maxTop = Math.max(0, container.clientHeight - elHeight);
        desiredLeft = clamp(desiredLeft, 0, maxLeft);
        desiredTop = clamp(desiredTop, 0, maxTop);
        
        if (isFree(desiredLeft, desiredTop)) {
            return { left: desiredLeft, top: desiredTop };
        }

        const step = 12;
        const maxRadius = Math.max(container.clientWidth, container.clientHeight);
        const maxSteps = Math.ceil(maxRadius / step) * 6;
        
        for (let r = 1; r < maxSteps; r++) {
            const angle = (r * 137.5) * (Math.PI / 180);
            const dx = Math.round(Math.cos(angle) * r) * step;
            const dy = Math.round(Math.sin(angle) * r) * step;
            const tryLeft = clamp(desiredLeft + dx, 0, maxLeft);
            const tryTop = clamp(desiredTop + dy, 0, maxTop);
            if (isFree(tryLeft, tryTop)) return { left: tryLeft, top: tryTop };
        }

        return { left: desiredLeft, top: desiredTop };
    }

    function dropElementAtTarget(el, centerX, centerY) {
        const targetRect = targetArea.getBoundingClientRect();
        targetArea.appendChild(el);
        el.style.position = 'absolute';

        let left = centerX - targetRect.left - dragState.offsetX;
        let top = centerY - targetRect.top - dragState.offsetY;

        left = clamp(left, 0, Math.max(0, targetArea.clientWidth - el.offsetWidth));
        top = clamp(top, 0, Math.max(0, targetArea.clientHeight - el.offsetHeight));
        
        const placed = placeWithoutOverlap(el, left, top, targetArea);
        el.style.left = placed.left + 'px';
        el.style.top = placed.top + 'px';

        el.dataset.onTarget = 'true';
        
        const color = el.dataset.initialColor;
        el.style.background = color;
        el.style.color = textColorForBg(color);
    }

    function returnElementToSource(el) {
        const sortedIndex = parseInt(el.dataset.sortedIndex, 10);
        const children = Array.from(sourceArea.querySelectorAll('.word-item'));
        let inserted = false;
        
        for (const child of children) {
            const si = parseInt(child.dataset.sortedIndex, 10);
            if (si > sortedIndex) {
                sourceArea.insertBefore(el, child);
                inserted = true;
                break;
            }
        }
        
        if (!inserted) sourceArea.appendChild(el);

        el.style.background = '#bdbdbd';
        el.style.color = '#111';
        el.dataset.onTarget = 'false';
        el.style.position = '';
        el.style.left = '';
        el.style.top = '';
        el.style.zIndex = '';
        el.style.width = '';
        el.style.height = '';
    }

    function onPointerUp(e) {
        if (!dragState || e.pointerId !== dragState.pointerId) return;
        const el = dragState.el;

        if (!dragState.initiated) {
            const inTarget = (el.dataset.onTarget === 'true') || (el.closest('#targetArea') === targetArea);
            if (inTarget) {
                const originalColor = el.dataset.initialColor || '#888';
                const chip = document.createElement('span');
                chip.className = 'display-chip';
                chip.textContent = el.dataset.origText;
                chip.style.color = originalColor;
                chip.style.border = 'none';
                chip.style.background = 'transparent';
                
                display.appendChild(chip);
            }
            
            try { 
                el.releasePointerCapture(dragState.pointerId); 
            } catch {}
            
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerUp);
            dragState = null;
            return;
        }

        const elRect = el.getBoundingClientRect();
        const centerX = elRect.left + elRect.width / 2;
        const centerY = elRect.top + elRect.height / 2;

        const targetRect = targetArea.getBoundingClientRect();
        const isInTarget = (centerX >= targetRect.left && centerX <= targetRect.right &&
                            centerY >= targetRect.top && centerY <= targetRect.bottom);

        if (isInTarget) {
            dropElementAtTarget(el, centerX, centerY);
        } else {
            returnElementToSource(el);
        }

        try { 
            el.releasePointerCapture(dragState.pointerId); 
        } catch {}
        
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
        el.classList.remove('dragging');
        dragState = null;
    }

    parseBtn.addEventListener('click', () => {
        const arr = parseInput(input.value);
        sourceArea.innerHTML = '';
        targetArea.innerHTML = '';
        display.innerHTML = '';
        
        arr.forEach((item, idx) => {
            const el = createWordElement(item, idx);
            sourceArea.appendChild(el);
        });
        
        updateEmptyMessage(targetArea);
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        sourceArea.innerHTML = '';
        targetArea.innerHTML = '';
        display.innerHTML = '';
        updateEmptyMessage(targetArea);
    });

    function updateEmptyMessage(container) {
        if (container.children.length === 0) {
            container.innerHTML = '<div class="empty-message"></div>';
        } else if (container.children.length === 1 && container.children[0].classList.contains('empty-message')) {
            container.innerHTML = '';
        }
    }

    document.addEventListener('dragstart', e => {
        if (!e.target.classList.contains('word-item')) e.preventDefault();
    });

    updateEmptyMessage(targetArea);
});