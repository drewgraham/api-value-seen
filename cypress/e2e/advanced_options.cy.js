import '../../cypress-plugin';

describe('API recording advanced options', () => {
  it('ignores and expects paths while enforcing delay threshold', () => {
    cy.startApiRecording({
      timeoutMs: 500,
      thresholdMs: 200,
      excludePaths: ['/api/ignore.secret'],
      expectAbsentPaths: ['/api/secret.token']
    });

    cy.intercept('/api/ignore', { body: { secret: 'nope' } }).as('ignore');
    cy.intercept('/api/slow', { body: { slow: 'delayed' } }).as('slowApi');
    cy.intercept('/api/secret', { body: { token: 'shh' } }).as('secret');

    cy.intercept('/demo', {
      body: `<!DOCTYPE html><html><body>
        <script>
          fetch('/api/ignore').then(r => r.json()).then(() => {});
          fetch('/api/slow').then(r => r.json()).then(d => {
            setTimeout(() => {
              const el = document.createElement('div');
              el.id = 'slow';
              el.textContent = d.slow;
              document.body.appendChild(el);
            }, 300);
          });
          fetch('/api/secret').then(r => r.json()).then(() => {});
        </script>
      </body></html>`,
      headers: { 'content-type': 'text/html' }
    });

    cy.visit('/demo');
    cy.wait('@ignore');
    cy.wait('@slowApi');
    cy.wait('@secret');

    cy.get('#slow').should('have.text', 'delayed');

    cy.stopApiRecording().then((report) => {
      expect(report).to.have.length(1);
      const field = report[0].fields[0];
      expect(field.apiPath).to.equal('/api/slow.slow');
      expect(field.firstSeenMs).to.be.greaterThan(200);
      // Fails the test if any other missing values exist
      expect(report, 'Only slow field should be reported').to.have.length(1);
    });
  });
});
