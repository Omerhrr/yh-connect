"use client";

import { Zap, Mail, Twitter, Linkedin, Instagram } from "lucide-react";
import { SmartLink } from "@/components/site/SmartLink";
import { useSiteContent } from "@/lib/siteContent";
import { useNav } from "@/store/nav";

export function Footer() {
  const { navigate } = useNav();
  const go = (v: Parameters<typeof navigate>[0]) => navigate(v);
  const footer = useSiteContent("footer");

  return (
    <footer className="border-t bg-muted/30 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {}
          <div className="md:col-span-1">
            <button onClick={() => go("home")} className="flex items-center gap-2 font-bold text-xl mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <span>YH <span className="text-primary">Connect</span></span>
            </button>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {footer.tagline}
            </p>
            <div className="flex items-center gap-3 mt-4">
              {footer.social.twitter && (
                <a href={footer.social.twitter} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <Twitter className="h-4 w-4" />
                </a>
              )}
              {footer.social.linkedin && (
                <a href={footer.social.linkedin} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <Linkedin className="h-4 w-4" />
                </a>
              )}
              {footer.social.instagram && (
                <a href={footer.social.instagram} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {footer.social.email && (
                <a href={footer.social.email} className="text-muted-foreground hover:text-primary transition-colors">
                  <Mail className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {footer.columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-semibold text-sm mb-3">{col.title}</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {col.links.map((link) => (
                  <li key={link.label + link.href}>
                    <SmartLink href={link.href} className="hover:text-foreground transition-colors">
                      {link.label}
                    </SmartLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {footer.copyright}
        </div>
      </div>
    </footer>
  );
}
