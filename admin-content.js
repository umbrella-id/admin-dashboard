/* Item actions */
.item-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    gap: 10px;
}

/* Toggle Publish */
.toggle-publish {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 0.7rem;
}

.toggle-publish input {
    display: none;
}

.toggle-publish .toggle-slider {
    width: 36px;
    height: 18px;
    background: #333;
    border-radius: 18px;
    position: relative;
    transition: 0.2s;
}

.toggle-publish .toggle-slider::before {
    content: '';
    position: absolute;
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: 0.2s;
}

.toggle-publish input:checked + .toggle-slider {
    background: #22c55e;
}

.toggle-publish input:checked + .toggle-slider::before {
    transform: translateX(18px);
}

.toggle-label {
    color: var(--text-muted);
}

/* Status badges */
.item-badge {
    position: absolute;
    top: -8px;
    right: 10px;
    font-size: 0.65rem;
    padding: 2px 8px;
    border-radius: 20px;
    font-weight: bold;
    z-index: 10;
}

.badge-new {
    background: #22c55e;
    color: white;
}

.badge-edited {
    background: #f59e0b;
    color: white;
}

.badge-deleted {
    background: #ff4444;
    color: white;
}

.content-item {
    position: relative;
    transition: all 0.2s;
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 15px;
    background: var(--bg-solid-form);
    border: 1px solid var(--border-line);
}

.content-item-new {
    background: rgba(34, 197, 94, 0.1);
    border-left: 3px solid #22c55e;
}

.content-item-edited {
    background: rgba(245, 158, 11, 0.1);
    border-left: 3px solid #f59e0b;
}

.content-item-deleted {
    background: rgba(255, 68, 68, 0.1);
    border-left: 3px solid #ff4444;
    opacity: 0.8;
}

.content-item-deleted input,
.content-item-deleted textarea,
.content-item-deleted select {
    text-decoration: line-through;
}

.content-header, .content-image-url, .content-caption, .content-body, .content-platform {
    width: 100%;
    background: var(--bg-dark);
    border: 1px solid var(--border-line);
    border-radius: 8px;
    padding: 10px;
    color: white;
    margin-bottom: 8px;
    font-family: inherit;
}

.content-body, .content-caption {
    min-height: 80px;
    resize: vertical;
}

.btn-delete-item {
    background: rgba(255, 68, 68, 0.2);
    border: 1px solid #ff4444;
    border-radius: 8px;
    padding: 6px 12px;
    color: #ff8888;
    cursor: pointer;
    font-size: 0.7rem;
}

.btn-add-item {
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid #4ade80;
    border-radius: 8px;
    padding: 8px 12px;
    color: #4ade80;
    cursor: pointer;
    width: 100%;
    margin-top: 10px;
}
