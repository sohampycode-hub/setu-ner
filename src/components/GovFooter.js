'use client';

export default function GovFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-300 bg-slate-900 text-slate-300 text-xs font-sans print:hidden">
      {/* Policy and Navigation Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 border-b border-slate-800">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-[11px]">
          <div>
            <span className="font-bold text-slate-100 uppercase tracking-wider block mb-2">
              Government Portals
            </span>
            <ul className="space-y-1 text-slate-400">
              <li><a href="https://mdoner.gov.in" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400">MDoNER Portal</a></li>
              <li><a href="https://ndma.gov.in" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400">NDMA India</a></li>
              <li><a href="https://morth.nic.in" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400">MoRTH Highways</a></li>
              <li><a href="https://bhuvan.nrsc.gov.in" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400">ISRO Bhuvan GIS</a></li>
            </ul>
          </div>
          <div>
            <span className="font-bold text-slate-100 uppercase tracking-wider block mb-2">
              Website Policies
            </span>
            <ul className="space-y-1 text-slate-400">
              <li><span className="hover:underline cursor-pointer">Copyright Policy</span></li>
              <li><span className="hover:underline cursor-pointer">Hyperlinking Policy</span></li>
              <li><span className="hover:underline cursor-pointer">Privacy Statement</span></li>
              <li><span className="hover:underline cursor-pointer">Terms of Use</span></li>
            </ul>
          </div>
          <div>
            <span className="font-bold text-slate-100 uppercase tracking-wider block mb-2">
              Technical Helpdesk
            </span>
            <ul className="space-y-1 text-slate-400">
              <li>NIC Emergency Support: 1800-11-4030</li>
              <li>Email: helpdesk-setuner@nic.in</li>
              <li>SDRF Guwahati Operations Hub</li>
            </ul>
          </div>
          <div>
            <span className="font-bold text-slate-100 uppercase tracking-wider block mb-2">
              Compliance & Security
            </span>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Designed, developed, and maintained in compliance with Guidelines for Indian Government Websites (GIGW 3.0).
            </p>
            <div className="mt-2 inline-block bg-slate-800 text-slate-300 text-[9px] px-2 py-0.5 rounded font-mono border border-slate-700">
              STQC / CERT-In Certified
            </div>
          </div>
        </div>
      </div>

      {/* Attribution & Copyright Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 gap-2">
        <p>
          © {currentYear} Ministry of Development of North Eastern Region, Government of India. All rights reserved.
        </p>
        <p className="font-mono text-slate-400">
          Hosted by National Informatics Centre (NIC) • Data Engine: PostGIS / ISRO Geodetic Frame
        </p>
      </div>
    </footer>
  );
}