import '../../cypress-plugin';

describe('complex API recording demo', () => {
  it('handles nested data across pages and reports unseen values', () => {
    cy.startApiRecording({ timeoutMs: 500 });

    cy.intercept('/api/first', { body: { user: { name: 'Alice' }, shared: 'dup' } }).as('api1');
    cy.intercept('/api/second', { body: { info: { deep: { value: 'two' }, label: 'dup' } } }).as('api2');
    cy.intercept('/api/third', {
      body: { secure: { tokens: { primary: 'hidden', secondary: 'shadow' } } }
    }).as('api3');

    cy.intercept('/page-a', {
      body: `<!DOCTYPE html><html><body>
        <h1>First Page</h1><p>Lots of content here.</p>
        <div id="content"></div>
        <script>
          fetch('/api/first').then(r => r.json()).then(d => {
            document.getElementById('content').innerHTML =
              '<div id="name">'+d.user.name+'</div>'+
              '<div id="dup1">'+d.shared+'</div>';
          });
        </script>
      </body></html>`,
      headers: { 'content-type': 'text/html' }
    });

    cy.intercept('/page-b', {
      body: `<!DOCTYPE html><html><body>
        <h1>Second Page</h1><p>More text...</p>
        <div id="content"></div>
        <script>
          fetch('/api/second').then(r => r.json()).then(d => {
            document.getElementById('content').innerHTML =
              '<div id="deep">'+d.info.deep.value+'</div>'+
              '<div id="dup2">'+d.info.label+'</div>';
          });
        </script>
      </body></html>`,
      headers: { 'content-type': 'text/html' }
    });

    cy.intercept('/page-c', {
      body: `<!DOCTYPE html><html><body>
        <h1>Third Page</h1><p>This page doesn't show API data.</p>
        <script>
          fetch('/api/third').then(r => r.json()).then(() => {});
        </script>
      </body></html>`,
      headers: { 'content-type': 'text/html' }
    });

    cy.visit('/page-a');
    cy.wait('@api1');
    cy.get('#name').should('have.text', 'Alice');
    cy.get('#dup1').should('have.text', 'dup');

    cy.visit('/page-b');
    cy.wait('@api2');
    cy.get('#deep').should('have.text', 'two');
    cy.get('#dup2').should('have.text', 'dup');

    cy.visit('/page-c');
    cy.wait('@api3');

    cy.stopApiRecording().then(report => {
      expect(report).to.have.length(1);
      const hidden = report[0];
      expect(hidden.url).to.include('/api/third');
      expect(hidden.fields).to.have.length(2);
      expect(hidden.fields[0].path).to.equal('secure.tokens.primary');
      expect(hidden.fields[0].apiPath).to.equal('/api/third.secure.tokens.primary');
      expect(hidden.fields[0].firstSeenMs).to.be.null;
      expect(hidden.fields[1].path).to.equal('secure.tokens.secondary');
      expect(hidden.fields[1].apiPath).to.equal('/api/third.secure.tokens.secondary');
      expect(hidden.fields[1].firstSeenMs).to.be.null;
    });
  });
});
