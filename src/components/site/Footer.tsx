"use client";

import { Zap, Mail, Twitter, Linkedin, Instagram } from "lucide-react";
import { useNav } from "@/store/nav";

export function Footer() {
  const { navigate } = useNav();
  const go = (v: Parameters<typeof navigate>[0]) => navigate(v);

  return (
    <footer className="border-t bg-muted/30 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <button onClick={() => go("home")} className="flex items-center gap-2 font-bold text-xl mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <span>YH <span className="text-primary">Connect</span></span>
            </button>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connecting Nigerian clients with verified architects, engineers, contractors, and construction trades.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a href="https://twitter.com" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Linkedin className="h-4 w-4" />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="mailto:hello@yhconnect.ng" className="text-muted-foreground hover:text-primary transition-colors">
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* For Clients */}
          <div>
            <h3 className="font-semibold text-sm mb-3">For Clients</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><button onClick={() => go("find-talent")} className="hover:text-foreground transition-colors">Find Professionals</button></li>
              <li><button onClick={() => go("how-it-works")} className="hover:text-foreground transition-colors">How It Works</button></li>
              <li><button onClick={() => go("client-register")} className="hover:text-foreground transition-colors">Post a Project</button></li>
              <li><button onClick={() => go("client-login")} className="hover:text-foreground transition-colors">Client Login</button></li>
            </ul>
          </div>

          {/* For Professionals */}
          <div>
            <h3 className="font-semibold text-sm mb-3">For Professionals</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><button onClick={() => go("find-work")} className="hover:text-foreground transition-colors">Find Projects</button></li>
              <li><button onClick={() => go("talent-register")} className="hover:text-foreground transition-colors">Create Profile</button></li>
              <li><button onClick={() => go("talent-login")} className="hover:text-foreground transition-colors">Professional Login</button></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><button onClick={() => go("blog")} className="hover:text-foreground transition-colors">Blog</button></li>
              <li><button onClick={() => go("privacy")} className="hover:text-foreground transition-colors">Privacy Policy</button></li>
              <li><button onClick={() => go("terms")} className="hover:text-foreground transition-colors">Terms of Service</button></li>
              <li>
                <a href="https://yhub.ng" className="hover:text-foreground transition-colors">
                  ← Back to Yahya Hub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} YH Connect · A product of Yahya Hub, Abuja, Nigeria. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
