import '../../cypress-plugin';

describe('API recording across pages', () => {
  it('captures values from multiple pages', () => {
    cy.startApiRecording({ timeoutMs: 500 });

    cy.intercept('/api/first', { body: { alpha: 'one' } }).as('api1');
    cy.intercept('/api/second', { body: { beta: 'two' } }).as('api2');

    cy.intercept('/page-one', {
      body: `<!DOCTYPE html><html><body><script>
        fetch('/api/first').then(r => r.json()).then(d => {
          const el = document.createElement('div');
          el.id = 'alpha';
          el.textContent = d.alpha;
          document.body.appendChild(el);
        });
      </script></body></html>`,
      headers: { 'content-type': 'text/html' }
    });

    cy.intercept('/page-two', {
      body: `<!DOCTYPE html><html><body><script>
        fetch('/api/second').then(r => r.json()).then(d => {
          const el = document.createElement('div');
          el.id = 'beta';
          el.textContent = d.beta;
          document.body.appendChild(el);
        });
      </script></body></html>`,
      headers: { 'content-type': 'text/html' }
    });

    cy.visit('/page-one');
    cy.wait('@api1');
    cy.get('#alpha').should('have.text', 'one');

    cy.visit('/page-two');
    cy.wait('@api2');
    cy.get('#beta').should('have.text', 'two');

    cy.stopApiRecording().then((report) => {
      expect(report).to.be.empty;
    });
  });
});

