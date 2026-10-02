import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardBack } from './CardBack';

const variants = ['row', 'face'] as const;

describe.each(variants)('CardBack (%s variant)', (variant) => {
  it('shows the translation, in the given language', () => {
    render(<CardBack card={{ definition: 'odchod, odlet' }} lang="sk" variant={variant} />);
    const translation = screen.getByText('odchod, odlet');
    expect(translation.tagName).toBe('P');
    expect(translation).toHaveAttribute('lang', 'sk');
  });

  it('sets no lang on the translation when none is given', () => {
    render(<CardBack card={{ definition: 'odchod' }} variant={variant} />);
    expect(screen.getByText('odchod')).not.toHaveAttribute('lang');
  });

  it('renders exactly one text element for a card with only a translation', () => {
    const { container } = render(<CardBack card={{ definition: 'odchod' }} variant={variant} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.children).toHaveLength(1);
    expect(wrapper.firstElementChild).toHaveTextContent('odchod');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows the meaning as an English paragraph after the translation', () => {
    const { container } = render(
      <CardBack card={{ definition: 'odchod', meaning: 'the act of leaving a place' }} lang="sk" variant={variant} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.children).toHaveLength(2);
    expect(wrapper.children[0]).toHaveTextContent('odchod');
    const meaning = screen.getByText('the act of leaving a place');
    expect(meaning).toBe(wrapper.children[1]);
    expect(meaning.tagName).toBe('P');
    expect(meaning).toHaveAttribute('lang', 'en');
  });

  it('shows examples as a list with one English item per line', () => {
    render(
      <CardBack
        card={{ definition: 'odchod', examples: 'The departure was delayed.\nHe waved at her departure.' }}
        lang="sk"
        variant={variant}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('The departure was delayed.');
    expect(items[1]).toHaveTextContent('He waved at her departure.');
    items.forEach((item) => expect(item).toHaveAttribute('lang', 'en'));
    expect(screen.getByRole('list')).toContainElement(items[0]);
  });

  it('ignores empty lines and trims each example line', () => {
    render(
      <CardBack card={{ definition: 'odchod', examples: '\n  First sentence.  \r\n\r\n   \nSecond sentence.\n' }} variant={variant} />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['First sentence.', 'Second sentence.']);
  });

  it('shows all three parts in order without any extra element', () => {
    const { container } = render(
      <CardBack
        card={{ definition: 'odchod', meaning: 'the act of leaving', examples: 'One.\nTwo.' }}
        lang="sk"
        variant={variant}
      />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(Array.from(wrapper.children).map((el) => el.tagName)).toEqual(['P', 'P', 'UL']);
    expect(wrapper.children[0]).toHaveTextContent('odchod');
    expect(wrapper.children[1]).toHaveTextContent('the act of leaving');
    expect(wrapper.children[2].children).toHaveLength(2);
  });

  it('leaves out an absent meaning without leaving an empty element', () => {
    const { container } = render(
      <CardBack card={{ definition: 'odchod', examples: 'Only an example.' }} variant={variant} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(Array.from(wrapper.children).map((el) => el.tagName)).toEqual(['P', 'UL']);
  });

  it('leaves out absent examples without leaving an empty element', () => {
    const { container } = render(
      <CardBack card={{ definition: 'odchod', meaning: 'Only a meaning.' }} variant={variant} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(Array.from(wrapper.children).map((el) => el.tagName)).toEqual(['P', 'P']);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it.each([
    ['empty strings', { meaning: '', examples: '' }],
    ['whitespace-only strings', { meaning: '   ', examples: ' \t ' }],
    ['only blank example lines', { meaning: ' \n ', examples: '\n  \n\r\n' }],
    ['undefined values', { meaning: undefined, examples: undefined }],
  ])('treats %s as absent', (_name, extras) => {
    const { container } = render(<CardBack card={{ definition: 'odchod', ...extras }} variant={variant} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.children).toHaveLength(1);
    expect(wrapper).toHaveTextContent(/^odchod$/);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(container.querySelector('[lang="en"]')).toBeNull();
  });

  it('trims the meaning before showing it', () => {
    render(<CardBack card={{ definition: 'odchod', meaning: '  the act of leaving  ' }} variant={variant} />);
    expect(screen.getByText('the act of leaving').textContent).toBe('the act of leaving');
  });
});

describe('CardBack variants', () => {
  const card = {
    definition: 'odchod, odlet',
    meaning: 'the act of leaving a place',
    examples: 'The departure was delayed.\nHe waved at her departure.',
  };

  it('renders the same content in both variants', () => {
    const row = render(<CardBack card={card} lang="sk" variant="row" />);
    const rowHtml = row.container.textContent;
    const rowShape = row.container.querySelectorAll('*').length;
    row.unmount();
    const face = render(<CardBack card={card} lang="sk" variant="face" />);
    expect(face.container.textContent).toBe(rowHtml);
    expect(face.container.querySelectorAll('*').length).toBe(rowShape);
  });

  it('defaults to the row variant', () => {
    const implicit = render(<CardBack card={card} lang="sk" />);
    const implicitClass = (implicit.container.firstElementChild as HTMLElement).className;
    implicit.unmount();
    const row = render(<CardBack card={card} lang="sk" variant="row" />);
    expect((row.container.firstElementChild as HTMLElement).className).toBe(implicitClass);
  });
});
