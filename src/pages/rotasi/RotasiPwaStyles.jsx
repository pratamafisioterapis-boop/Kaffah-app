import React from 'react';

const CSS = `
@media (max-width: 768px) {
  .rotasi-modal-overlay {
    padding: 0 !important;
    align-items: flex-end !important;
  }
  .rotasi-modal-card {
    width: 100% !important;
    max-width: 100% !important;
    max-height: 92vh !important;
    border-radius: 16px 16px 0 0 !important;
    padding: 20px !important;
    box-sizing: border-box !important;
  }
  .rotasi-page-header {
    flex-direction: column !important;
    align-items: stretch !important;
  }
  .rotasi-page-header > button {
    width: 100% !important;
  }
  .rotasi-therapist-grid {
    grid-template-columns: 1fr !important;
  }
  .rotasi-two-col {
    grid-template-columns: 1fr !important;
  }
  .rotasi-slot-form {
    flex-direction: column !important;
    align-items: stretch !important;
  }
  .rotasi-slot-form input,
  .rotasi-slot-form select,
  .rotasi-slot-form button {
    width: 100% !important;
  }
  .rotasi-toolbar {
    flex-direction: column !important;
    align-items: stretch !important;
  }
  .rotasi-toolbar > div {
    margin-left: 0 !important;
  }
}

@media (max-width: 480px) {
  .rotasi-modal-card h1,
  .rotasi-modal-card h2 {
    font-size: 16px !important;
  }
}
`;

const RotasiPwaStyles = () => <style>{CSS}</style>;

export default RotasiPwaStyles;