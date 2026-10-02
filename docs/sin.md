# SIN — tile properties

12-byte records associate property choices with mask indices 0/1. Listed fields: UINT16LE active0,active1; UINT32LE property0; UINT16LE property1.

## Verification notes

Source discrepancy: the listed fields total 10 bytes, but the source declares 12-byte records. Local SIN files are 1296 bytes (108×12), consistent with the declared stride. Field offsets remain unverified.

## Sources

- [Track formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Track_Format)

Read on 2026-10-02. [Format index](README.md).
