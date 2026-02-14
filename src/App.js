/**
 * RNPS Record Sheet Mobile App
 * React PWA Frontend - Exact replica of desktop PyQt6 UI
 * With JWT Authentication
 */

import React, { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import './App.css';
import SignatureCanvas from './components/SignatureCanvas';
import Login from './components/Login';

// Identity proof codes (A-H)
const IDENTITY_CODES = {
  'A': 'Driving Licence',
  'B': 'Utility, telephone or council tax bill',
  'C': 'A bank or building society statement',
  'D': 'Passport',
  'E': 'Foreign National Identity Card',
  'F': 'Debit or Credit Card',
  'G': 'A police warrant card',
  'H': 'An armed forces identity card',
};

// Entitlement proof codes (1-9)
const ENTITLEMENT_CODES = {
  '1': 'Registration Certificate (V5C)',
  '2': 'Tear off slip V5C/2 section 10 of the V5C',
  '3': 'Certificate of entitlement to a mark (V750)',
  '4': 'Cherished transfer retention document (V778)',
  '5': 'Vehicle licence renewal form (V11)',
  '6': 'Temporary registration certificate (V379)',
  '7': 'Authorisation Certificate (V948) with Official DVLA stamp',
  '8': 'Letter of authorisation from Fleet Operators',
  '9': 'Record of insurer\'s name, reference and policy number',
};

function App() {
  // Authentication state - MUST be first
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(null);

  const [formData, setFormData] = useState({
    company_name: 'Plate Lab',  // Permanent field
    supplier_id: '74678',  // Permanent field
    vehicle_reg: '',
    customer_name: '',
    address: '',
    post_town: '',
    postcode: '',
    print_name: '',
    sig_date: new Date().toISOString().split('T')[0],
  });

  const [identitySelections, setIdentitySelections] = useState({});
  const [entitlementSelections, setEntitlementSelections] = useState({});
  const [loading, setLoading] = useState(false);
  const signatureRef = useRef(null);

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const expiry = localStorage.getItem('token_expiry');
    
    if (token && expiry && Date.now() < parseInt(expiry)) {
      setAuthToken(token);
      setIsAuthenticated(true);
    } else {
      // Clear expired token
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token_expiry');
    }
  }, []);

  // Handle successful login
  const handleLogin = (token) => {
    setAuthToken(token);
    setIsAuthenticated(true);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token_expiry');
    setAuthToken(null);
    setIsAuthenticated(false);
  };

  // If not authenticated, show login screen
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Handle input changes - FIX #2: Keep keyboard open
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Keep focus to prevent keyboard dismissal
    setTimeout(() => e.target.focus(), 0);
  };

  // Handle checkbox changes with max 3 selection limit
  const handleCheckboxChange = (type, code) => {
    const selections = type === 'identity' ? identitySelections : entitlementSelections;
    const setSelections = type === 'identity' ? setIdentitySelections : setEntitlementSelections;

    const newSelections = { ...selections };

    if (newSelections[code]) {
      // Uncheck
      delete newSelections[code];
    } else {
      // Check - but enforce max 3 limit
      const selectedCount = Object.keys(newSelections).length;
      if (selectedCount >= 3) {
        toast.error('You can only select up to 3 items.');
        return;
      }
      newSelections[code] = { checked: true, serial: '' };
    }

    setSelections(newSelections);
  };

  // Handle serial number input
  const handleSerialChange = (type, code, value) => {
    const selections = type === 'identity' ? identitySelections : entitlementSelections;
    const setSelections = type === 'identity' ? setIdentitySelections : setEntitlementSelections;

    setSelections({
      ...selections,
      [code]: { ...selections[code], serial: value }
    });
  };

  // Validate form
  const validateForm = () => {
    const errors = [];

    if (!formData.company_name.trim()) errors.push('Company Name is required');
    if (!formData.vehicle_reg.trim()) errors.push('Vehicle Registration Mark is required');
    if (!formData.customer_name.trim()) errors.push('Customer\'s Name is required');

    if (Object.keys(identitySelections).length === 0) {
      errors.push('At least one Proof of Identity must be selected');
    }

    if (Object.keys(entitlementSelections).length === 0) {
      errors.push('At least one Proof of Entitlement must be selected');
    }

    return errors;
  };

  // Generate PDF - FIX #5: Proper error handling
  const generatePDF = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      toast.error('Please fix the following errors:\n\n• ' + errors.join('\n• '));
      return;
    }

    setLoading(true);

    try {
      // Get signature data
      const signatureBase64 = signatureRef.current?.getSignatureData();

      // Prepare identity codes
      const identity_codes = Object.entries(identitySelections).map(([code, data]) => [
        code,
        data.serial || ''
      ]);

      // Prepare entitlement codes
      const entitlement_codes = Object.entries(entitlementSelections).map(([code, data]) => [
        code,
        data.serial || ''
      ]);

      // Prepare data for backend
      const requestData = {
        ...formData,
        identity_codes,
        entitlement_codes,
        signature_base64: signatureBase64,
      };

      // Call backend API
      const response = await fetch('https://rnps-backend-production.up.railway.app/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,  // Add JWT token
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        // Check if token expired
        if (response.status === 401) {
          handleLogout();
          toast.error('Session expired. Please login again.');
          return;
        }
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate PDF');
      }

      // Download PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const vehicle_reg = formData.vehicle_reg.replace(/\s/g, '').toUpperCase();
      const customer_name = formData.customer_name.replace(/\s/g, '_');
      const date_str = new Date().toISOString().split('T')[0].replace(/-/g, '');
      a.download = `RNPS_Record_${vehicle_reg}_${customer_name}_${date_str}.pdf`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('RNPS Record Sheet PDF generated successfully!');

    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Clear form
  const clearForm = () => {
    if (!window.confirm('Are you sure you want to clear all form fields?')) {
      return;
    }

    // Clear everything except company_name and supplier_id (permanent fields)
    setFormData(prev => ({
      ...prev,
      vehicle_reg: '',
      customer_name: '',
      address: '',
      post_town: '',
      postcode: '',
      print_name: '',
      sig_date: new Date().toISOString().split('T')[0],
    }));

    setIdentitySelections({});
    setEntitlementSelections({});
    signatureRef.current?.clear();
  };

  return (
    <div className="app">
      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: '#333', color: '#fff', borderRadius: '8px' }, success: { duration: 3000, iconTheme: { primary: '#52C41A', secondary: '#fff' } }, error: { duration: 4000 } }} />
      {/* Header */}
      <header className="header">
        <img src="/logo.png" alt="Logo" className="logo" />
        <h1 className="header-title">PLATELAB RNPS</h1>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {/* Main Form */}
      <div className="scroll-container">
        <div className="form-container">
          
          {/* Company Details Section */}
          <div className="card">
            <h2 className="card-title">Company Details</h2>
            <div className="form-group">
              <label>Company Name * <span className="permanent-label">(Permanent)</span></label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                readOnly
                className="input input-readonly"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Supplier Identity Number <span className="permanent-label">(Permanent)</span></label>
                <input
                  type="text"
                  name="supplier_id"
                  value={formData.supplier_id}
                  readOnly
                  className="input input-readonly"
                />
              </div>
              <div className="form-group">
                <label>Vehicle Registration Mark *</label>
                <input
                  type="text"
                  name="vehicle_reg"
                  value={formData.vehicle_reg}
                  onChange={handleInputChange}
                  placeholder="e.g. AB12 CDE"
                  className="input"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
            </div>
          </div>

          {/* Customer Details Section */}
          <div className="card">
            <h2 className="card-title">Customer Details</h2>
            <div className="form-group">
              <label>Customer's Name *</label>
              <input
                type="text"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleInputChange}
                placeholder="Enter customer name"
                className="input"
              />
            </div>

            <div className="form-group">
              <label>Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Enter address"
                className="textarea"
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Post Town</label>
                <input
                  type="text"
                  name="post_town"
                  value={formData.post_town}
                  onChange={handleInputChange}
                  placeholder="Enter post town"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Postcode</label>
                <input
                  type="text"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleInputChange}
                  placeholder="e.g. SW1A 1AA"
                  className="input"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
            </div>
          </div>

          {/* Proof of Identity Section */}
          <div className="card">
            <h2 className="card-title">Proof of Identity</h2>
            <p className="info-text">(Select up to 3 items)</p>
            
            {Object.entries(IDENTITY_CODES).map(([code, description]) => (
              <div key={code} className="checkbox-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!identitySelections[code]}
                    onChange={() => handleCheckboxChange('identity', code)}
                    className="checkbox"
                  />
                  <span>{code} - {description}</span>
                </label>
                <input
                  type="text"
                  placeholder="Serial/Issue Number"
                  value={identitySelections[code]?.serial || ''}
                  onChange={(e) => handleSerialChange('identity', code, e.target.value)}
                  disabled={!identitySelections[code]}
                  className="serial-input"
                />
              </div>
            ))}
          </div>

          {/* Proof of Entitlement Section */}
          <div className="card">
            <h2 className="card-title">Proof of Entitlement</h2>
            <p className="info-text">(Select up to 3 items)</p>
            
            {Object.entries(ENTITLEMENT_CODES).map(([code, description]) => (
              <div key={code} className="checkbox-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!entitlementSelections[code]}
                    onChange={() => handleCheckboxChange('entitlement', code)}
                    className="checkbox"
                  />
                  <span>{code} - {description}</span>
                </label>
                <input
                  type="text"
                  placeholder="Serial/Issue Number"
                  value={entitlementSelections[code]?.serial || ''}
                  onChange={(e) => handleSerialChange('entitlement', code, e.target.value)}
                  disabled={!entitlementSelections[code]}
                  className="serial-input"
                />
              </div>
            ))}
          </div>

          {/* Signature Section */}
          <div className="card">
            <h2 className="card-title">Signature</h2>
            
            <SignatureCanvas ref={signatureRef} />

            <div className="form-row" style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  name="sig_date"
                  value={formData.sig_date}
                  onChange={handleInputChange}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Print Name</label>
                <input
                  type="text"
                  name="print_name"
                  value={formData.print_name}
                  onChange={handleInputChange}
                  placeholder="Print name"
                  className="input"
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer with Buttons */}
      <footer className="footer">
        <button className="btn-secondary" onClick={clearForm} disabled={loading}>
          Clear Form
        </button>
        <button className="btn-primary" onClick={generatePDF} disabled={loading}>
          {loading ? 'Generating...' : 'Generate PDF'}
        </button>
      </footer>
    </div>
  );
}

export default App;