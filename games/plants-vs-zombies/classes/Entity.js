export class Entity {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width; // Standard 80
        this.height = height; // Standard 100
        this.element = null;
        this.markedForDeletion = false;
    }

    createDOM(className, content = '') {
        const el = document.createElement('div');
        el.className = className;
        el.innerHTML = content;
        el.style.left = `${this.x}px`;
        el.style.top = `${this.y}px`;
        document.getElementById('game-board').appendChild(el);
        this.element = el;
        return el;
    }

    update() {
        // Override in subclasses
    }

    draw() {
        if (this.element) {
            this.element.style.left = `${this.x}px`;
            this.element.style.top = `${this.y}px`;
        }
    }

    remove() {
        if (this.element) {
            this.element.remove();
        }
        this.markedForDeletion = true;
    }
}
