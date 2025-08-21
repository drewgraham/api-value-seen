import '../../cypress-plugin';

describe('API recording plugin', () => {
  beforeEach(() => {
    cy.startApiRecording({ timeoutMs: 500 });
    cy.intercept('/api/test', { body: { foo: 'bar' } }).as('api');
  });

  it('records when value appears in DOM', () => {
    cy.intercept('/test-page', {
      body: `<!DOCTYPE html><html><body><script>
        fetch('/api/test').then(r => r.json()).then(d => {
          const el = document.createElement('div');
          el.id = 'result';
          el.textContent = d.foo;
          document.body.appendChild(el);
        });
      </script></body></html>`,
      headers: { 'content-type': 'text/html' }
    });

    cy.visit('/test-page');
    cy.wait('@api');
    cy.stopApiRecording().then(report => {
      expect(report).to.be.empty;
    });
  });

  it('handles value not appearing in DOM', () => {
    cy.intercept('/test-page', {
      body: `<!DOCTYPE html><html><body><script>
        fetch('/api/test').then(r => r.json()).then(d => {
          // value not inserted into DOM
        });
      </script></body></html>`,
      headers: { 'content-type': 'text/html' }
    });

    cy.visit('/test-page');
    cy.wait('@api');
    cy.wait(600);
    cy.stopApiRecording().then(report => {
      expect(report).to.have.length(1);
      const field = report[0].fields[0];
      expect(field).to.have.property('firstSeenMs', null);
      expect(field.lastCheckedMs).to.be.gte(500);
    });
  });
});
