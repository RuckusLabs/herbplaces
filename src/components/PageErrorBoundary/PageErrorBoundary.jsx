import { Component } from 'react';
import PropTypes from 'prop-types';

export default class PageErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main id="main-content" className="container route-error">
      <h1>Let’s try that page again.</h1>
      <p>The page didn’t finish loading. Check your connection, then try again.</p>
      <div className="route-error-actions"><button type="button" className="button" onClick={() => window.location.reload()}>Try Again</button><a href="/">Go to Home</a></div>
    </main>;
  }
}

PageErrorBoundary.propTypes = { children: PropTypes.node.isRequired };
