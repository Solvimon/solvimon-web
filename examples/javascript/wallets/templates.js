export function injectTemplates() {
    const wrapper = document.createElement('div');

    wrapper.innerHTML = `
        <template id="table-skeleton-template">
            <div class="animate-pulse rounded-lg border border-slate-200 p-5">
                <div class="mb-6 flex justify-between">
                    <div class="h-4 w-44 rounded bg-slate-200"></div>
                    <div class="h-8 w-24 rounded bg-slate-100"></div>
                </div>
                <div class="space-y-4">
                    <div class="h-16 rounded bg-slate-100"></div>
                    <div class="h-16 rounded bg-slate-100"></div>
                    <div class="h-16 rounded bg-slate-100"></div>
                </div>
            </div>
        </template>

        <template id="actions-skeleton-template">
            <div class="animate-pulse rounded-lg border border-slate-200 p-5">
                <div class="mb-4 h-4 w-36 rounded bg-slate-200"></div>
                <div class="space-y-3">
                    <div class="h-10 rounded bg-slate-100"></div>
                    <div class="h-10 rounded bg-slate-100"></div>
                    <div class="h-10 rounded bg-slate-100"></div>
                </div>
            </div>
        </template>
    `;

    document.body.append(...wrapper.children);
}

export function renderTemplate(templateId, root) {
    const template = document.getElementById(templateId);
    if (!template || !root) return;

    root.replaceChildren(template.content.cloneNode(true));
}

export function renderTemplates() {
    document.querySelectorAll('[data-template-root]').forEach((root) => {
        renderTemplate(root.dataset.templateRoot, root);
    });
}
