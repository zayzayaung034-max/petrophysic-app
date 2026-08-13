import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const API_BASE_URL = 'http://127.0.0.1:8000';

interface BackendAnalysisResponse {
  well_name: string;
  summary: {
    total_interval_ft: number;
    net_pay_ft: number;
    is_commercial: boolean;
  };
  depths: number[];
  curves: {
    GR?: (number | null)[];
    VSH?: (number | null)[];
    PHID?: (number | null)[];
    NPHI?: (number | null)[];
    RT?: (number | null)[];
    PHIE?: (number | null)[];
    SW?: (number | null)[];
  };
}

export const LasUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [downloadingCsv, setDownloadingCsv] = useState<boolean>(false);

  const [rawPayload, setRawPayload] = useState<BackendAnalysisResponse | null>(null);

  const [analysis, setAnalysis] = useState<{
    well_name: string;
    interval_ft: number;
    net_pay_ft: number;
    is_commercial: boolean;
    curves: {
      depth: number[];
      gr: (number | null)[];
      vsh: (number | null)[];
      phid: (number | null)[];
      nphi: (number | null)[];
      sw: (number | null)[];
    };
  }>({
    well_name: 'TEST-WELL-01',
    interval_ft: 5.0,
    net_pay_ft: 0.0,
    is_commercial: false,
    curves: {
      depth: [7000, 7001, 7002, 7003, 7004, 7005],
      gr: [40, 45, 90, 110, 80, 45],
      vsh: [0.0, 0.15, 0.9, 0.95, 1.0, 0.25],
      phid: [0.15, 0.12, 0.22, 0.18, 0.12, 0.1],
      nphi: [0.18, 0.22, 0.25, 0.21, 0.14, 0.12],
      sw: [0.65, 0.64, 0.98, 0.85, 0.66, 0.68],
    },
  });

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setStatus('Analyzing well log file...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze-las`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let detail = 'Analysis failed';
        try {
          const parsed = JSON.parse(errorText);
          detail = parsed.detail || detail;
        } catch {
          detail = errorText || detail;
        }
        setStatus(`Error: ${detail}`);
        return;
      }

      const data: BackendAnalysisResponse = await response.json();
      setStatus(`Successfully analyzed: ${data.well_name}`);
      setRawPayload(data);

      setAnalysis({
        well_name: data.well_name,
        interval_ft: data.summary.total_interval_ft,
        net_pay_ft: data.summary.net_pay_ft,
        is_commercial: data.summary.is_commercial,
        curves: {
          depth: data.depths || [],
          gr: data.curves.GR || [],
          vsh: data.curves.VSH || [],
          phid: data.curves.PHID || [],
          nphi: data.curves.NPHI || [],
          sw: data.curves.SW || [],
        },
      });
    } catch (err: any) {
      console.error(err);
      setStatus(`Server connection error. Ensure FastAPI is running on ${API_BASE_URL}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = async () => {
    setDownloadingCsv(true);

    const payloadToSend = rawPayload || {
      well_name: analysis.well_name,
      summary: {
        total_interval_ft: analysis.interval_ft,
        net_pay_ft: analysis.net_pay_ft,
        is_commercial: analysis.is_commercial,
      },
      depths: analysis.curves.depth,
      curves: {
        GR: analysis.curves.gr,
        VSH: analysis.curves.vsh,
        PHID: analysis.curves.phid,
        NPHI: analysis.curves.nphi,
        SW: analysis.curves.sw,
      },
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/export-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadToSend),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${payloadToSend.well_name || 'well_log'}_calculated.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return;
      }
    } catch (err) {
      console.warn('Backend CSV export unavailable, executing browser fallback:', err);
    } finally {
      setDownloadingCsv(false);
    }

    // Browser-side CSV fallback
    try {
      const wellName = payloadToSend.well_name || 'well_log';
      const depths = payloadToSend.depths || [];
      const gr = payloadToSend.curves?.GR || [];
      const vsh = payloadToSend.curves?.VSH || [];
      const phid = payloadToSend.curves?.PHID || [];
      const nphi = payloadToSend.curves?.NPHI || [];
      const sw = payloadToSend.curves?.SW || [];

      const headers = ['Depth_FT', 'GR_API', 'VSH_fraction', 'PHID_fraction', 'NPHI_fraction', 'SW_fraction'];
      const rows = depths.map((d, i) => [
        d ?? '',
        gr[i] ?? '',
        vsh[i] ?? '',
        phid[i] ?? '',
        nphi[i] ?? '',
        sw[i] ?? '',
      ]);

      const csvData = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${wellName}_calculated.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV generation failed:', err);
      alert('Failed to generate CSV.');
    }
  };

  const handleDownloadPDF = async () => {
    const payloadToSend = rawPayload || {
      well_name: analysis.well_name,
      summary: {
        total_interval_ft: analysis.interval_ft,
        net_pay_ft: analysis.net_pay_ft,
        is_commercial: analysis.is_commercial,
      },
      depths: analysis.curves.depth,
      curves: {
        GR: analysis.curves.gr,
        VSH: analysis.curves.vsh,
        PHID: analysis.curves.phid,
        NPHI: analysis.curves.nphi,
        SW: analysis.curves.sw,
      },
    };

    setDownloadingPdf(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadToSend),
      });

      if (!response.ok) {
        const errorDetail = await response.text();
        throw new Error(`Server status ${response.status}: ${errorDetail}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${payloadToSend.well_name || 'well_log'}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('PDF Download Error:', err);
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        alert(`Network Error: Cannot reach backend at ${API_BASE_URL}. Ensure FastAPI is running and CORS is enabled.`);
      } else {
        alert(`PDF export error: ${err.message}`);
      }
    } finally {
      setDownloadingPdf(false);
    }
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      y: {
        reverse: true,
        title: { display: true, text: 'Measured Depth (FT)', color: '#666' },
        grid: { color: '#f0f0f0' },
      },
      xTop: {
        type: 'linear',
        position: 'top',
        min: 0,
        max: 150,
        title: { display: true, text: 'Gamma Ray (API)', color: '#666' },
        grid: { drawOnChartArea: false },
      },
      xBottom: {
        type: 'linear',
        position: 'bottom',
        min: 0,
        max: 1.0,
        title: { display: true, text: 'Fraction (Vsh / Porosity / Sw)', color: '#666' },
        grid: { color: '#f0f0f0' },
      },
    },
  };

  const chartData = {
    labels: analysis.curves.depth,
    datasets: [
      {
        label: 'GR',
        data: analysis.curves.gr as number[],
        borderColor: '#ef4444',
        backgroundColor: '#ef4444',
        xAxisID: 'xTop',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
      },
      {
        label: 'VSH',
        data: analysis.curves.vsh as number[],
        borderColor: '#eab308',
        backgroundColor: '#eab308',
        xAxisID: 'xBottom',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
      },
      {
        label: 'PHID',
        data: analysis.curves.phid as number[],
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f6',
        xAxisID: 'xBottom',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
      },
      {
        label: 'NPHI',
        data: analysis.curves.nphi as number[],
        borderColor: '#10b981',
        backgroundColor: '#10b981',
        borderDash: [5, 5],
        xAxisID: 'xBottom',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
      },
      {
        label: 'Sw',
        data: analysis.curves.sw as number[],
        borderColor: '#a855f7',
        backgroundColor: '#a855f7',
        xAxisID: 'xBottom',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
      },
    ],
  };

  const verdictText = analysis.is_commercial
    ? 'Commercial Reservoir Pay Zone'
    : 'Non-Commercial / Non-Productive Barrier Zone';

  return (
    <div style={{ textAlign: 'center', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2>Petrophysical LAS Log Analyzer</h2>

      {/* File Selection */}
      <div style={{ marginBottom: '20px' }}>
        <input type="file" accept=".las" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        {file && (
          <button
            onClick={handleUpload}
            disabled={loading}
            style={{ marginLeft: '10px', padding: '6px 12px', cursor: 'pointer' }}
          >
            {loading ? 'Processing...' : 'Process Log'}
          </button>
        )}
        {status && (
          <div style={{ marginTop: '10px', fontSize: '14px', color: status.startsWith('Error') ? 'red' : '#0369a1' }}>
            {status}
          </div>
        )}
      </div>

      {analysis && (
        <>
          {/* Export Controls */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
            <button
              onClick={handleDownloadCSV}
              disabled={downloadingCsv}
              style={{
                padding: '8px 16px',
                border: '1px solid #333',
                background: '#fff',
                borderRadius: '4px',
                cursor: 'pointer',
                opacity: downloadingCsv ? 0.6 : 1,
              }}
            >
              📥 {downloadingCsv ? 'Exporting CSV...' : 'Export CSV Data'}
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPdf}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                borderRadius: '4px',
                cursor: 'pointer',
                opacity: downloadingPdf ? 0.6 : 1,
              }}
            >
              📄 {downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}
            </button>
          </div>

          {/* Result Card */}
          <div
            style={{
              backgroundColor: analysis.is_commercial ? '#dcfce7' : '#fee2e2',
              border: `1px solid ${analysis.is_commercial ? '#22c55e' : '#ef4444'}`,
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '500px',
              margin: '0 auto 24px',
              color: analysis.is_commercial ? '#14532d' : '#7f1d1d',
            }}
          >
            <h3 style={{ margin: '0 0 10px' }}>Well: {analysis.well_name}</h3>
            <p style={{ margin: '4px 0', fontSize: '15px' }}>
              <strong>Total Interval Analyzed:</strong> {analysis.interval_ft} FT
            </p>
            <p style={{ margin: '4px 0', fontSize: '15px' }}>
              <strong>Calculated Net Pay:</strong> {analysis.net_pay_ft} FT
            </p>
            <h4 style={{ margin: '12px 0 0' }}>
              Verdict: {analysis.is_commercial ? '✅' : '❌'} {verdictText}
            </h4>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px', fontSize: '12px', color: '#555', marginBottom: '10px' }}>
            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>— GR</span>
            <span style={{ color: '#eab308', fontWeight: 'bold' }}>— VSH</span>
            <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>— PHID</span>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>--- NPHI</span>
            <span style={{ color: '#a855f7', fontWeight: 'bold' }}>— Sw</span>
          </div>

          {/* Plot Canvas */}
          <div style={{ height: '400px', width: '100%', maxWidth: '700px', margin: '0 auto' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </>
      )}
    </div>
  );
};

export default LasUploader;