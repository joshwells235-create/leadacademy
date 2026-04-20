import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

/**
 * Server-side PDF template for LMS certificates. Kept visual-only —
 * all data is passed in as props so this module is a pure component
 * and the caller can compose the PDF buffer via `renderToBuffer` from
 * `@react-pdf/renderer`.
 *
 * Design goals:
 *  - Landscape, single page, professional but brand-aligned.
 *  - Looks credible enough to attach to a LinkedIn post.
 *  - Works with the default react-pdf fonts (Helvetica) so we don't
 *    pay a cold-start cost registering custom fonts. Colors match the
 *    brand-navy / brand-blue / brand-pink tokens.
 */

// Brand tokens mirrored from globals.css. Keep in sync if they change.
const BRAND_NAVY = "#101d51";
const BRAND_BLUE = "#007efa";
const BRAND_PINK = "#EA0C67";
const BRAND_LIGHT = "#f3f3f3";
const NEUTRAL_500 = "#737373";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    padding: 48,
    fontFamily: "Helvetica",
  },
  border: {
    position: "absolute",
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    borderWidth: 2,
    borderColor: BRAND_NAVY,
    borderRadius: 6,
  },
  innerBorder: {
    position: "absolute",
    top: 32,
    left: 32,
    right: 32,
    bottom: 32,
    borderWidth: 0.5,
    borderColor: BRAND_BLUE,
    borderRadius: 4,
  },
  header: {
    marginTop: 8,
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: BRAND_PINK,
    fontFamily: "Helvetica-Bold",
  },
  programName: {
    marginTop: 6,
    fontSize: 16,
    color: NEUTRAL_500,
  },
  awardedTo: {
    marginTop: 42,
    fontSize: 11,
    color: NEUTRAL_500,
    textTransform: "uppercase",
    letterSpacing: 2,
    textAlign: "center",
  },
  learnerName: {
    marginTop: 12,
    fontSize: 36,
    color: BRAND_NAVY,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  divider: {
    alignSelf: "center",
    marginTop: 14,
    width: 72,
    height: 2,
    backgroundColor: BRAND_BLUE,
  },
  completionText: {
    marginTop: 24,
    fontSize: 13,
    color: "#404040",
    textAlign: "center",
    lineHeight: 1.6,
  },
  completionTitle: {
    fontSize: 22,
    color: BRAND_NAVY,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 56,
    right: 56,
    bottom: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerBlock: {
    maxWidth: 220,
  },
  footerLabel: {
    fontSize: 8,
    color: NEUTRAL_500,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  footerValue: {
    marginTop: 4,
    fontSize: 11,
    color: BRAND_NAVY,
  },
  footerMeta: {
    fontSize: 9,
    color: NEUTRAL_500,
    marginTop: 2,
  },
  watermark: {
    position: "absolute",
    right: 56,
    top: 56,
    fontSize: 9,
    color: BRAND_LIGHT,
  },
});

export type CertificateProps = {
  learnerName: string;
  /** e.g. "Course" or "Learning Path" */
  kindLabel: string;
  /** The course or path title being awarded. */
  subjectTitle: string;
  /** Formatted issue date, e.g. "April 19, 2026" */
  issuedOn: string;
  /** Formatted expiration date or "Non-expiring" */
  expiresOn: string | null;
  /** Certificate id (shown in the footer so HR / hiring managers can verify). */
  certificateId: string;
  /** Organization name offering the program, e.g. "Leadership Academy by LeadShift" */
  issuerName?: string;
};

export function CertificateDocument({
  learnerName,
  kindLabel,
  subjectTitle,
  issuedOn,
  expiresOn,
  certificateId,
  issuerName = "Leadership Academy",
}: CertificateProps) {
  return (
    <Document title={`${learnerName} — ${subjectTitle}`} author={issuerName} producer={issuerName}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border} />
        <View style={styles.innerBorder} />

        <View style={styles.header}>
          <Text style={styles.eyebrow}>Certificate of Completion</Text>
          <Text style={styles.programName}>{issuerName}</Text>
        </View>

        <Text style={styles.awardedTo}>This certifies that</Text>
        <Text style={styles.learnerName}>{learnerName}</Text>
        <View style={styles.divider} />

        <Text style={styles.completionText}>
          has successfully completed the {kindLabel.toLowerCase()}
        </Text>
        <Text style={styles.completionTitle}>{subjectTitle}</Text>

        <View style={styles.footer}>
          <View style={styles.footerBlock}>
            <Text style={styles.footerLabel}>Issued</Text>
            <Text style={styles.footerValue}>{issuedOn}</Text>
            {expiresOn && (
              <>
                <Text style={[styles.footerLabel, { marginTop: 8 }]}>Expires</Text>
                <Text style={styles.footerValue}>{expiresOn}</Text>
              </>
            )}
          </View>
          <View style={[styles.footerBlock, { alignItems: "flex-end" }]}>
            <Text style={styles.footerLabel}>Verification ID</Text>
            <Text style={styles.footerMeta}>{certificateId}</Text>
            <Text style={[styles.footerMeta, { marginTop: 8 }]}>
              Verify at leadacademy.vercel.app
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
