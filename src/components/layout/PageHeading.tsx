import type { ReactNode } from "react";

interface PageHeadingProps {
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  children?: ReactNode;
}

export function PageHeading({ title, description, image, imageAlt = "", children }: PageHeadingProps) {
  return (
    <header className="page-heading">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
        {children && <div className="mt-5 flex flex-wrap items-center gap-3">{children}</div>}
      </div>
      {image && <img src={image} alt={imageAlt} width={1302} height={868}
        className="hidden h-36 w-60 shrink-0 rounded-xl object-cover lg:block" />}
    </header>
  );
}
